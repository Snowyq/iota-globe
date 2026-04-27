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
            if (!target.isConnected) return;
            if (!ref.current || ref.current.contains(target)) return;
            callback();
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [ref, callback, enabled]);
}
