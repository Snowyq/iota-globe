"use client";

import {
    useContext,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from "react";
import { GlobeContext } from "./GlobeContext";
import { ClusterMarker } from "./ClusterMarker";
import { clusterValidators, getClusterCellSize } from "./clustering";
import type {
    GlobeController,
    MapMode,
    PointOfView,
    WorkerInput,
    WorkerOutput,
} from "./workerTypes";

export function Globe({
    onReady,
    mode = "globe",
    touchInteractive = false,
}: {
    onReady?: (controller: GlobeController) => void;
    mode?: MapMode;
    touchInteractive?: boolean;
}) {
    const { onGlobeReady, onGlobeDispose, geoPoints, setAutoRotate } =
        useContext(GlobeContext);
    const rootRef = useRef<HTMLDivElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const markerRefs = useRef(new Map<string, HTMLDivElement>());
    const modeRef = useRef(mode);
    const touchInteractiveRef = useRef(touchInteractive);
    const resetGestureRef = useRef<() => void>(() => {});
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

    useEffect(() => {
        touchInteractiveRef.current = touchInteractive;
        resetGestureRef.current();
    }, [touchInteractive]);

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
        let view: PointOfView = { lat: 26, lng: 8, altitude: 2.1 };
        let autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
        const pointers = new Map<number, { x: number; y: number }>();
        let center: { x: number; y: number } | null = null;
        let pinchDistance = 0,
            pinchAltitude = view.altitude;
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
        };
        resetGestureRef.current = resetGesture;
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
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || !canvas) return;
            if (event.pointerType === "touch" && !touchInteractiveRef.current)
                return;
            if (pointers.size >= 2) return;
            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
            });
            canvas.setPointerCapture?.(event.pointerId);
            center = midpoint();
            pinchDistance = distance();
            pinchAltitude = view.altitude;
            stopRotation();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!pointers.has(event.pointerId) || !center) return;
            if (event.pointerType === "touch" && !touchInteractiveRef.current) {
                resetGesture();
                return;
            }
            event.preventDefault();
            pointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
            });
            const next = midpoint();
            post({
                type: "drag",
                dx: next.x - center.x,
                dy: next.y - center.y,
            });
            center = next;
            const nextDistance = distance();
            if (pinchDistance > 0 && nextDistance > 0)
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
        const onPointerUp = (event: PointerEvent) => {
            pointers.delete(event.pointerId);
            if (canvas?.hasPointerCapture?.(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
            center = pointers.size ? midpoint() : null;
            pinchDistance = 0;
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
                controller.pointOfView({
                    altitude: Math.max(
                        0.55,
                        Math.min(
                            5,
                            view.altitude * (event.key === "-" ? 1.2 : 0.85)
                        )
                    ),
                });
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
                        "Interactive network map. Drag or use arrow keys to pan. Use plus and minus to zoom."
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
                                node.hidden = !marker.visible;
                                node.inert = !marker.visible;
                                if (marker.visible)
                                    node.style.transform = `translate3d(${marker.x}px, ${marker.y}px, 0)`;
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
                        } satisfies WorkerInput,
                        [offscreen]
                    );
                    post({ type: "data", ...latestData.current });
                    observer.observe(root);
                    intersection.observe(root);
                    canvas.addEventListener("pointerdown", onPointerDown);
                    canvas.addEventListener("pointermove", onPointerMove);
                    canvas.addEventListener("pointerup", onPointerUp);
                    canvas.addEventListener("pointercancel", onPointerUp);
                    canvas.addEventListener("lostpointercapture", onPointerUp);
                    canvas.addEventListener("keydown", onKeyDown);
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
            worker?.terminate();
            workerRef.current = null;
            resetGesture();
            resetGestureRef.current = () => {};
            canvas?.remove();
            notifyDispose();
        };
    }, []);

    if (failure) throw new Error(failure);
    return (
        <div
            className="globe-worker-stage"
            ref={rootRef}
            data-touch-interactive={touchInteractive}
        >
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
