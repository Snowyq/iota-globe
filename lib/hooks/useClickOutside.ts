"use client";

import { RefObject, useEffect } from "react";

export function useClickOutside(
    ref: RefObject<HTMLElement | null>,
    callback: () => void,
    enabled = true
) {
    useEffect(() => {
        if (!enabled) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element;
            if (!ref.current || ref.current.contains(target)) return;
            if (target.closest("[data-radix-popper-content-wrapper]")) return;
            callback();
        };
        // Use "click" not "mousedown" — drag/rotate fires mousedown but not click
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [ref, callback, enabled]);
}
