import { clampAltitude, ZOOM_IN, ZOOM_OUT } from "./view";
import type { WorkerInput } from "./workerTypes";

// "wheel": a plain scroll over the map; "touch": one finger tried to turn it.
export type GestureHint = "wheel" | "touch";

type Point = { x: number; y: number };

export type GlobeInputTarget = {
    post: (message: WorkerInput) => void;
    altitude: () => number;
    setAltitude: (altitude: number) => void;
    stopRotation: () => void;
    hint: (hint: GestureHint) => void;
};

// Two-finger turn and pinch each wait for a clear start, and wait longer
// while the other one is already running.
const PINCH_TO_START = 0.08;
const PINCH_WHILE_TURNING = 0.18;
const TURN_TO_START = 10;
const TURN_WHILE_ZOOMING = 28;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 32;
const ARROW_STEPS: Record<string, [number, number]> = {
    ArrowLeft: [24, 0],
    ArrowRight: [-24, 0],
    ArrowUp: [0, 20],
    ArrowDown: [0, -20],
};

/** Wires pointer, touch, wheel and keyboard input; returns a detach function. */
export function attachGlobeInput(
    root: HTMLElement,
    canvas: HTMLCanvasElement,
    target: GlobeInputTarget
) {
    const { post, stopRotation, hint } = target;
    const pointers = new Map<number, Point>();
    let center: Point | null = null;
    let pinchDistance = 0;
    let pinchAltitude = target.altitude();
    let gestureStart = { x: 0, y: 0, spread: 0 };
    let turning = false;
    let zooming = false;
    let downAt = { x: 0, y: 0 };
    let lastTap = { x: 0, y: 0, t: 0 };
    let moved = false;
    let touchStart: Point | null = null;
    let touchHinted = false;

    const midpoint = (): Point => {
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
    const dragTo = (next: Point) => {
        if (center)
            post({
                type: "drag",
                dx: next.x - center.x,
                dy: next.y - center.y,
            });
        center = next;
    };
    const capture = (id: number) => {
        if (!canvas.hasPointerCapture?.(id)) canvas.setPointerCapture?.(id);
    };
    const releaseCapture = (id: number) => {
        if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    };
    const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
        const rect = canvas.getBoundingClientRect();
        stopRotation();
        post({
            type: "zoom",
            factor,
            ...(clientX != null && clientY != null
                ? { x: clientX - rect.left, y: clientY - rect.top }
                : {}),
        });
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || pointers.size >= 2) return;
        if (!pointers.size) {
            downAt = { x: event.clientX, y: event.clientY };
            moved = false;
        }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        // A second finger means a gesture, never a tap.
        if (pointers.size >= 2) moved = true;
        // Presses on markers stay clicks until they move (see onPointerMove).
        if (event.target === canvas)
            canvas.setPointerCapture?.(event.pointerId);
        center = midpoint();
        pinchDistance = distance();
        pinchAltitude = target.altitude();
        if (pointers.size >= 2) {
            gestureStart = { ...midpoint(), spread: distance() };
            turning = false;
            zooming = false;
        }
        stopRotation();
    };

    const onTwoFingerMove = (next: Point) => {
        const spread = distance();
        // Zoom from the spread at the moment it started, so it never jumps.
        if (!zooming && gestureStart.spread > 0) {
            const change = Math.abs(spread / gestureStart.spread - 1);
            if (change > (turning ? PINCH_WHILE_TURNING : PINCH_TO_START)) {
                zooming = true;
                pinchDistance = spread;
                pinchAltitude = target.altitude();
            }
        }
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
        if (turning) dragTo(next);
        if (zooming && pinchDistance > 0 && spread > 0)
            target.setAltitude(
                clampAltitude((pinchAltitude * pinchDistance) / spread)
            );
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId) || !center) return;
        event.preventDefault();
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        // On touch, one finger scrolls the page; the globe needs two.
        const touch = event.pointerType === "touch";
        if (touch && pointers.size < 2) return;
        if (
            !moved &&
            Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6
        ) {
            moved = true;
            capture(event.pointerId);
        }
        if (!moved && !touch) return;
        if (pointers.size < 2) dragTo(midpoint());
        else onTwoFingerMove(midpoint());
    };

    // Two quick taps close together zoom in.
    const onTap = (event: PointerEvent) => {
        const quick = event.timeStamp - lastTap.t < DOUBLE_TAP_MS;
        const near =
            Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <
            DOUBLE_TAP_PX;
        if (quick && near) {
            zoomAt(0.6, event.clientX, event.clientY);
            lastTap = { x: 0, y: 0, t: 0 };
        } else {
            lastTap = {
                x: event.clientX,
                y: event.clientY,
                t: event.timeStamp,
            };
        }
    };

    const onPointerUp = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        const touch = event.pointerType === "touch";
        if (!pointers.size && event.type === "pointerup") {
            if (moved) post({ type: "release" });
            else if (touch) onTap(event);
        }
        // The finger left behind after a two-finger turn doesn't carry on.
        if (touch && pointers.size === 1 && moved) post({ type: "release" });
        releaseCapture(event.pointerId);
        center = pointers.size ? midpoint() : null;
        pinchDistance = pointers.size >= 2 ? distance() : 0;
        pinchAltitude = target.altitude();
        turning = false;
        zooming = false;
    };

    // Touch events only stop the page panning under a two-finger gesture,
    // and hint when a single finger swipes sideways.
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
            hint("touch");
        }
    };

    // Plain scroll belongs to the page. Ctrl/Cmd + scroll (and trackpad
    // pinch, which arrives as ctrl) zooms.
    const onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) {
            if (Math.abs(event.deltaY) > 4) hint("wheel");
            return;
        }
        event.preventDefault();
        const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
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
        const step = ARROW_STEPS[event.key];
        if (step) {
            event.preventDefault();
            stopRotation();
            post({ type: "drag", dx: step[0], dy: step[1] });
        }
        if (["+", "=", "-"].includes(event.key)) {
            event.preventDefault();
            zoomAt(event.key === "-" ? ZOOM_OUT : ZOOM_IN);
        }
    };

    // Listeners go on the root, not the canvas, so drags and ctrl-scroll
    // also work over markers.
    const rootListeners = [
        ["pointerdown", onPointerDown],
        ["pointermove", onPointerMove],
        ["pointerup", onPointerUp],
        ["pointercancel", onPointerUp],
        ["lostpointercapture", onPointerUp],
    ] as const;
    const passive = { passive: false };
    for (const [type, listener] of rootListeners)
        root.addEventListener(type, listener);
    canvas.addEventListener("keydown", onKeyDown);
    root.addEventListener("wheel", onWheel, passive);
    root.addEventListener("touchstart", onTouchStart, passive);
    root.addEventListener("touchmove", onTouchMove, passive);
    canvas.addEventListener("dblclick", onDoubleClick);

    return () => {
        for (const [type, listener] of rootListeners)
            root.removeEventListener(type, listener);
        root.removeEventListener("wheel", onWheel);
        root.removeEventListener("touchstart", onTouchStart);
        root.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("keydown", onKeyDown);
        canvas.removeEventListener("dblclick", onDoubleClick);
        for (const id of pointers.keys()) releaseCapture(id);
        pointers.clear();
        center = null;
        pinchDistance = 0;
        turning = false;
        zooming = false;
    };
}
