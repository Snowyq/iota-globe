"use client";

import { RefObject, useEffect } from "react";

const DRAG_THRESHOLD_PX = 5;

export function useClickOutside(
    ref: RefObject<HTMLElement | null>,
    callback: () => void,
    enabled = true
) {
    useEffect(() => {
        if (!enabled) return;

        let downX = 0;
        let downY = 0;

        const onPointerDown = (e: PointerEvent) => {
            downX = e.clientX;
            downY = e.clientY;
        };

        const handler = (e: MouseEvent) => {
            const dx = e.clientX - downX;
            const dy = e.clientY - downY;
            if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;

            const target = e.target as Element;
            if (!target.isConnected) return;
            if (!ref.current || ref.current.contains(target)) return;
            if (target.closest("[data-radix-popper-content-wrapper]")) return;
            callback();
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("click", handler);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("click", handler);
        };
    }, [ref, callback, enabled]);
}
