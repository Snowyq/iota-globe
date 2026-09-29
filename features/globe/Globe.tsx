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
import { attachGlobeInput, type GestureHint } from "./globeInput";
import { REDUCED_MOTION } from "@/lib/motion";
import { HOME_VIEW } from "./view";
import type {
    GlobeController,
    GlobeFrame,
    MapMode,
    PointOfView,
    WorkerInput,
    WorkerOutput,
} from "./workerTypes";

export type { GestureHint } from "./globeInput";

type Marker = Extract<WorkerOutput, { type: "frame" }>["markers"][number];

// Panels over the canvas report their size via --globe-inset-* vars.
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

function createCanvas(root: HTMLElement) {
    const canvas = document.createElement("canvas");
    canvas.className = "globe-worker-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute(
        "aria-label",
        "Interactive network map. Drag or use arrow keys to pan. Use plus and minus, or Command and scroll, to zoom. Double-click to zoom in."
    );
    root.prepend(canvas);
    return canvas;
}

// Only touch the DOM when something changed; even same-value writes
// invalidate style.
function placeMarkers(markers: Marker[], nodes: Map<string, HTMLDivElement>) {
    for (const marker of markers) {
        const node = nodes.get(marker.id);
        if (!node) continue;
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

export function Globe({
    onReady,
    onView,
    onHint,
    mode = "globe",
}: {
    onReady?: (controller: GlobeController) => void;
    // Camera view on each projected frame (~15 Hz).
    onView?: (view: PointOfView) => void;
    // A gesture that did nothing, e.g. a plain scroll.
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

    // One pulse per fresh checkpoint.
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
        const media = window.matchMedia(REDUCED_MOTION);
        let disposed = false;
        let worker: Worker | null = null;
        let canvas: HTMLCanvasElement | null = null;
        let detachInput: (() => void) | null = null;
        let firstFrame = 0;
        let secondFrame = 0;
        let width = 1;
        let height = 1;
        let inView = true;
        let view: PointOfView = { ...HOME_VIEW.globe };
        let autoRotate = !media.matches;

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
        const updateCell = () =>
            setCell((previous) => {
                const next = getClusterCellSize(
                    view.altitude,
                    width,
                    modeRef.current
                );
                return previous === next ? previous : next;
            });
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
        const motion = () => {
            post({ type: "motion", reduced: media.matches });
            if (media.matches) stopRotation();
        };
        const onMessage = (message: WorkerOutput) => {
            if (message.type === "ready") {
                notifyReady(controller);
                visibility();
            }
            if (message.type === "error") setFailure(message.message);
            if (message.type === "frame") {
                view = message.view;
                reportView(view);
                updateCell();
                placeMarkers(message.markers, markerRefs.current);
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

        const start = () => {
            canvas = createCanvas(root);
            width = Math.max(1, root.clientWidth);
            height = Math.max(1, root.clientHeight);
            const offscreen = canvas.transferControlToOffscreen();
            worker = new Worker(new URL("./globe.worker.ts", import.meta.url), {
                type: "module",
                name: "iota-network-map",
            });
            workerRef.current = worker;
            worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
                if (!disposed) onMessage(event.data);
            };
            worker.onerror = (event) => {
                event.preventDefault();
                if (!disposed)
                    setFailure("The background map renderer could not start.");
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
            detachInput = attachGlobeInput(root, canvas, {
                post,
                altitude: () => view.altitude,
                setAltitude: (altitude) => controller.pointOfView({ altitude }),
                stopRotation,
                hint: reportHint,
            });
            document.addEventListener("visibilitychange", visibility);
            media.addEventListener("change", motion);
        };

        // Two frames so the page and loader paint before the worker spins up.
        firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                if (disposed) return;
                try {
                    start();
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
            detachInput?.();
            worker?.terminate();
            workerRef.current = null;
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
