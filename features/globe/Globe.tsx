"use client";

import {
    useContext,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from "react";
import { useCheckpointEvents } from "@/features/network/CheckpointStream";
import { GlobeContext } from "./GlobeContext";
import { ClusterMarker } from "./ClusterMarker";
import { clusterValidators, getClusterCellSize } from "./clustering";
import type {
    GlobeController,
    GlobeFrame,
    MapMode,
    PointOfView,
    WorkerInput,
    WorkerOutput,
} from "./workerTypes";

// "wheel": a plain scroll over the map; "touch": one finger tried to turn it.
export type GestureHint = "wheel" | "touch";

// The stage may cover parts of the canvas with panels and say so through
// --globe-inset-* (registered lengths); the planet is framed in the rest.
function planetFrame(element: HTMLElement): GlobeFrame {
    const style = getComputedStyle(element);
    const read = (side: keyof GlobeFrame) => {
        const value = parseFloat(
            style.getPropertyValue(`--globe-inset-${side}`)
        );
        return Number.isFinite(value) ? value : 0;
    };
    return {
        top: read("top"),
        right: read("right"),
        bottom: read("bottom"),
        left: read("left"),
    };
}

export function Globe({
    onReady,
    onView,
    onHint,
    mode = "globe",
}: {
    onReady?: (controller: GlobeController) => void;
    // Called with the camera's view on each projected frame (~15 Hz).
    onView?: (view: PointOfView) => void;
    // A gesture that did nothing on the map, worth a hint (a plain scroll).
    onHint?: (hint: GestureHint) => void;
    mode?: MapMode;
}) {
    const onCheckpoint = useCheckpointEvents();
    const { onGlobeReady, onGlobeDispose, geoPoints, setAutoRotate } =
        useContext(GlobeContext);
    const rootRef = useRef<HTMLDivElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const markerRefs = useRef(new Map<string, HTMLDivElement>());
    const modeRef = useRef(mode);
    const [cell, setCell] = useState(24);
    const [failure, setFailure] = useState<string | null>(null);
    const clusters = useMemo(
        () => clusterValidators(geoPoints, cell),
        [geoPoints, cell]
    );
    const latestData = useRef({ points: geoPoints, clusters });
    const notifyReady = useEffectEvent((controller: GlobeController) => {
        onGlobeReady(controller);
        onReady?.(controller);
    });
    const notifyDispose = useEffectEvent(() => onGlobeDispose());
    const stopRotation = useEffectEvent(() => setAutoRotate(false));
    const reportView = useEffectEvent((view: PointOfView) => onView?.(view));
    const reportHint = useEffectEvent((hint: GestureHint) => onHint?.(hint));

    // Each checkpoint certified while the page is open sends one pulse.
    useEffect(
        () =>
            onCheckpoint((checkpoint) => {
                if (Date.now() - Number(checkpoint.timestampMs) > 4_000) return;
                workerRef.current?.postMessage({
                    type: "pulse",
                    load: checkpoint.txCount,
                } satisfies WorkerInput);
            }),
        [onCheckpoint]
    );

    useEffect(() => {
        latestData.current = { points: geoPoints, clusters };
        workerRef.current?.postMessage({
            type: "data",
            ...latestData.current,
        } satisfies WorkerInput);
    }, [geoPoints, clusters]);
    useEffect(() => {
        modeRef.current = mode;
        workerRef.current?.postMessage({
            type: "mode",
            mode,
        } satisfies WorkerInput);
    }, [mode]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        if (
            !window.Worker ||
            !HTMLCanvasElement.prototype.transferControlToOffscreen
        ) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFailure(
                "This browser does not support background map rendering."
            );
            return;
        }
        let disposed = false,
            worker: Worker | null = null;
        let firstFrame = 0,
            secondFrame = 0,
            canvas: HTMLCanvasElement | null = null;
        let width = 1,
            height = 1,
            inView = true;
        let view: PointOfView = { lat: 22, lng: 8, altitude: 2.4 };
        let autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
        const pointers = new Map<number, { x: number; y: number }>();
        let center: { x: number; y: number } | null = null;
        let pinchDistance = 0,
            pinchAltitude = view.altitude;
        // Two fingers turning the globe never hold their spread exactly, and
        // two fingers pinching never hold their midpoint still. Each half of
        // the gesture waits for a clear intent before it acts, and waits
        // longer while the other half is already under way.
        let gestureStart = { x: 0, y: 0, spread: 0 };
        let turning = false,
            zooming = false;
        const PINCH_TO_START = 0.08;
        const PINCH_WHILE_TURNING = 0.18;
        const TURN_TO_START = 10;
        const TURN_WHILE_ZOOMING = 28;
        const startGesture = () => {
            const mid = midpoint();
            gestureStart = { x: mid.x, y: mid.y, spread: distance() };
            turning = false;
            zooming = false;
        };
        const midpoint = () => {
            const values = [...pointers.values()];
            return {
                x: values.reduce((sum, p) => sum + p.x, 0) / values.length,
                y: values.reduce((sum, p) => sum + p.y, 0) / values.length,
            };
        };
        const distance = () => {
            const [a, b] = [...pointers.values()];
            return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
        };
        const resetGesture = () => {
            for (const id of pointers.keys())
                if (canvas?.hasPointerCapture?.(id))
                    canvas.releasePointerCapture(id);
            pointers.clear();
            center = null;
            pinchDistance = 0;
            turning = false;
            zooming = false;
        };
        const post = (message: WorkerInput) => worker?.postMessage(message);
        const controls = {
            get autoRotate() {
                return autoRotate;
            },
            set autoRotate(value: boolean) {
                autoRotate = value;
                post({ type: "rotate", enabled: value });
            },
        };
        const controller: GlobeController = {
            pointOfView: ((
                next?: Partial<PointOfView>,
                duration: number = 0
            ) => {
                if (!next) return { ...view };
                view = { ...view, ...next };
                post({ type: "view", view: next, duration });
            }) as GlobeController["pointOfView"],
            controls: () => controls,
            renderer: () => ({ domElement: canvas! }),
        };
        const resize = () => {
            width = Math.max(1, Math.round(root.clientWidth));
            height = Math.max(1, Math.round(root.clientHeight));
            post({
                type: "resize",
                width,
                height,
                pixelRatio: window.devicePixelRatio,
                frame: planetFrame(root),
            });
            setCell(getClusterCellSize(view.altitude, width, modeRef.current));
        };
        const visibility = () =>
            post({ type: "visibility", visible: inView && !document.hidden });
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const motion = () => {
            post({ type: "motion", reduced: media.matches });
            if (media.matches) stopRotation();
        };
        // Taps for double-tap zoom: where and when the last one landed.
        let downAt = { x: 0, y: 0, t: 0 };
        let lastTap = { x: 0, y: 0, t: 0 };
        let moved = false;
        const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
            const rect = canvas?.getBoundingClientRect();
            stopRotation();
            post({
                type: "zoom",
                factor,
                ...(rect && clientX != null && clientY != null
                    ? { x: clientX - rect.left, y: clientY - rect.top }
                    : {}),
            });
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || !canvas) return;
            if (pointers.size >= 2) return;
            if (!pointers.size) {
                downAt = {
                    x: event.clientX,
                    y: event.clientY,
                    t: event.timeStamp,
                };
                moved = false;
            }
            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
            });
            // A second finger makes this a gesture, never a tap.
            if (pointers.size >= 2) moved = true;
            // A press on a marker stays a click until it moves; only then
            // does the map take the pointer (see the move handler).
            if (event.target === canvas)
                canvas.setPointerCapture?.(event.pointerId);
            center = midpoint();
            pinchDistance = distance();
            pinchAltitude = view.altitude;
            if (pointers.size >= 2) startGesture();
            stopRotation();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!pointers.has(event.pointerId) || !center) return;
            event.preventDefault();
            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
            });
            // On a touch screen one finger belongs to the page: it scrolls.
            // The globe follows two, turning with their midpoint and zooming
            // with their spread.
            const touch = event.pointerType === "touch";
            if (touch && pointers.size < 2) return;
            if (
                !moved &&
                Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) >
                    6
            ) {
                moved = true;
                if (canvas && !canvas.hasPointerCapture?.(event.pointerId))
                    canvas.setPointerCapture?.(event.pointerId);
            }
            if (!moved && !touch) return;
            const next = midpoint();
            if (pointers.size < 2) {
                post({
                    type: "drag",
                    dx: next.x - center.x,
                    dy: next.y - center.y,
                });
                center = next;
                return;
            }
            const nextDistance = distance();
            // Zoom starts only on a clear change of spread, and then from
            // the spread it started at, so it never jumps.
            if (!zooming && gestureStart.spread > 0) {
                const change = Math.abs(nextDistance / gestureStart.spread - 1);
                if (change > (turning ? PINCH_WHILE_TURNING : PINCH_TO_START)) {
                    zooming = true;
                    pinchDistance = nextDistance;
                    pinchAltitude = view.altitude;
                }
            }
            // Likewise the turn waits for the midpoint to travel.
            if (!turning) {
                const travel = Math.hypot(
                    next.x - gestureStart.x,
                    next.y - gestureStart.y
                );
                if (travel > (zooming ? TURN_WHILE_ZOOMING : TURN_TO_START)) {
                    turning = true;
                    center = next;
                }
            }
            if (turning) {
                post({
                    type: "drag",
                    dx: next.x - center.x,
                    dy: next.y - center.y,
                });
                center = next;
            }
            if (zooming && pinchDistance > 0 && nextDistance > 0)
                controller.pointOfView({
                    altitude: Math.max(
                        0.55,
                        Math.min(
                            5,
                            (pinchAltitude * pinchDistance) / nextDistance
                        )
                    ),
                });
        };
        // Touch events only decide what the browser may do: a gesture that
        // starts with two fingers is the globe's, so the page must not pan
        // under it. One finger is left alone and scrolls as usual; if it
        // swipes sideways, say how to turn the globe.
        let touchStart: { x: number; y: number } | null = null;
        let touchHinted = false;
        const onTouchStart = (event: TouchEvent) => {
            if (event.touches.length >= 2) {
                if (event.cancelable) event.preventDefault();
                touchStart = null;
                return;
            }
            const t = event.touches[0];
            touchStart = { x: t.clientX, y: t.clientY };
            touchHinted = false;
        };
        const onTouchMove = (event: TouchEvent) => {
            if (event.touches.length >= 2) {
                if (event.cancelable) event.preventDefault();
                return;
            }
            if (!touchStart || touchHinted) return;
            const t = event.touches[0];
            const dx = Math.abs(t.clientX - touchStart.x);
            const dy = Math.abs(t.clientY - touchStart.y);
            if (dx > 36 && dx > dy * 2) {
                touchHinted = true;
                reportHint("touch");
            }
        };
        const onPointerUp = (event: PointerEvent) => {
            if (!pointers.has(event.pointerId)) return;
            pointers.delete(event.pointerId);
            if (!pointers.size && event.type === "pointerup") {
                if (moved) post({ type: "release" });
                else if (event.pointerType === "touch") {
                    // Two quick taps close together zoom in where they land.
                    const quick = event.timeStamp - lastTap.t < 320;
                    const near =
                        Math.hypot(
                            event.clientX - lastTap.x,
                            event.clientY - lastTap.y
                        ) < 32;
                    if (quick && near) {
                        zoomAt(0.6, event.clientX, event.clientY);
                        lastTap = { x: 0, y: 0, t: 0 };
                    } else
                        lastTap = {
                            x: event.clientX,
                            y: event.clientY,
                            t: event.timeStamp,
                        };
                }
            }
            // Lifting one of two fingers ends the turn; the one left
            // behind cannot carry on alone.
            if (event.pointerType === "touch" && pointers.size === 1 && moved)
                post({ type: "release" });
            if (canvas?.hasPointerCapture?.(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
            center = pointers.size ? midpoint() : null;
            pinchDistance = pointers.size >= 2 ? distance() : 0;
            pinchAltitude = view.altitude;
            turning = false;
            zooming = false;
        };
        // Scroll belongs to the page; with ⌘ or Ctrl held (and for trackpad
        // pinches, which arrive that way) it zooms the map instead.
        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) {
                if (Math.abs(event.deltaY) > 4) reportHint("wheel");
                return;
            }
            event.preventDefault();
            const delta =
                event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
            zoomAt(
                Math.exp(Math.max(-0.5, Math.min(0.5, delta * 0.0025))),
                event.clientX,
                event.clientY
            );
        };
        const onDoubleClick = (event: MouseEvent) => {
            event.preventDefault();
            zoomAt(event.shiftKey ? 1.6 : 0.6, event.clientX, event.clientY);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            const steps: Record<string, [number, number]> = {
                ArrowLeft: [24, 0],
                ArrowRight: [-24, 0],
                ArrowUp: [0, 20],
                ArrowDown: [0, -20],
            };
            if (steps[event.key]) {
                event.preventDefault();
                stopRotation();
                post({
                    type: "drag",
                    dx: steps[event.key][0],
                    dy: steps[event.key][1],
                });
            }
            if (["+", "=", "-"].includes(event.key)) {
                event.preventDefault();
                zoomAt(event.key === "-" ? 1.2 : 0.85);
            }
        };
        const observer = new ResizeObserver(resize);
        const intersection = new IntersectionObserver(
            ([entry]) => {
                inView = entry.isIntersecting;
                visibility();
            },
            { rootMargin: "100px" }
        );
        // Allow the page and its loader to paint before creating the worker.
        firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                if (disposed) return;
                try {
                    canvas = document.createElement("canvas");
                    canvas.className = "globe-worker-canvas";
                    canvas.tabIndex = 0;
                    canvas.setAttribute(
                        "aria-label",
                        "Interactive network map. Drag or use arrow keys to pan. Use plus and minus, or Command and scroll, to zoom. Double-click to zoom in."
                    );
                    root.prepend(canvas);
                    width = Math.max(1, root.clientWidth);
                    height = Math.max(1, root.clientHeight);
                    const offscreen = canvas.transferControlToOffscreen();
                    worker = new Worker(
                        new URL("./globe.worker.ts", import.meta.url),
                        { type: "module", name: "iota-network-map" }
                    );
                    workerRef.current = worker;
                    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
                        if (disposed) return;
                        const message = event.data;
                        if (message.type === "ready") {
                            notifyReady(controller);
                            visibility();
                        }
                        if (message.type === "error")
                            setFailure(message.message);
                        if (message.type === "frame") {
                            view = message.view;
                            reportView(view);
                            setCell((previous) => {
                                const next = getClusterCellSize(
                                    view.altitude,
                                    width,
                                    modeRef.current
                                );
                                return previous === next ? previous : next;
                            });
                            for (const marker of message.markers) {
                                const node = markerRefs.current.get(marker.id);
                                if (!node) continue;
                                // Writing an unchanged attribute or style still
                                // invalidates style, so only write changes.
                                if (node.hidden === marker.visible) {
                                    node.hidden = !marker.visible;
                                    node.inert = !marker.visible;
                                }
                                if (!marker.visible) continue;
                                const transform = `translate3d(${Math.round(marker.x * 2) / 2}px, ${Math.round(marker.y * 2) / 2}px, 0px)`;
                                if (node.style.transform !== transform)
                                    node.style.transform = transform;
                            }
                        }
                    };
                    worker.onerror = (event) => {
                        event.preventDefault();
                        if (!disposed)
                            setFailure(
                                "The background map renderer could not start."
                            );
                    };
                    worker.postMessage(
                        {
                            type: "init",
                            canvas: offscreen,
                            width,
                            height,
                            pixelRatio: window.devicePixelRatio,
                            reducedMotion: media.matches,
                            mode: modeRef.current,
                            frame: planetFrame(root),
                        } satisfies WorkerInput,
                        [offscreen]
                    );
                    post({ type: "data", ...latestData.current });
                    observer.observe(root);
                    intersection.observe(root);
                    // On the stage, not the canvas, so a drag can start on
                    // a marker too.
                    root.addEventListener("pointerdown", onPointerDown);
                    root.addEventListener("pointermove", onPointerMove);
                    root.addEventListener("pointerup", onPointerUp);
                    root.addEventListener("pointercancel", onPointerUp);
                    root.addEventListener("lostpointercapture", onPointerUp);
                    canvas.addEventListener("keydown", onKeyDown);
                    // Also on the stage, so ⌘-scroll zooms over a marker.
                    root.addEventListener("wheel", onWheel, {
                        passive: false,
                    });
                    root.addEventListener("touchstart", onTouchStart, {
                        passive: false,
                    });
                    root.addEventListener("touchmove", onTouchMove, {
                        passive: false,
                    });
                    canvas.addEventListener("dblclick", onDoubleClick);
                    document.addEventListener("visibilitychange", visibility);
                    media.addEventListener("change", motion);
                } catch {
                    setFailure("The background map renderer is unavailable.");
                }
            });
        });
        return () => {
            disposed = true;
            cancelAnimationFrame(firstFrame);
            cancelAnimationFrame(secondFrame);
            observer.disconnect();
            intersection.disconnect();
            document.removeEventListener("visibilitychange", visibility);
            media.removeEventListener("change", motion);
            root.removeEventListener("pointerdown", onPointerDown);
            root.removeEventListener("pointermove", onPointerMove);
            root.removeEventListener("pointerup", onPointerUp);
            root.removeEventListener("pointercancel", onPointerUp);
            root.removeEventListener("lostpointercapture", onPointerUp);
            root.removeEventListener("wheel", onWheel);
            root.removeEventListener("touchstart", onTouchStart);
            root.removeEventListener("touchmove", onTouchMove);
            worker?.terminate();
            workerRef.current = null;
            resetGesture();
            canvas?.remove();
            notifyDispose();
        };
    }, []);

    if (failure) throw new Error(failure);
    return (
        <div className="globe-worker-stage" ref={rootRef}>
            {clusters.map((cluster) => (
                <div
                    key={cluster.id}
                    hidden
                    inert
                    className="globe-marker-anchor"
                    ref={(node) => {
                        if (node) markerRefs.current.set(cluster.id, node);
                        else markerRefs.current.delete(cluster.id);
                    }}
                >
                    <ClusterMarker cluster={cluster} />
                </div>
            ))}
        </div>
    );
}
