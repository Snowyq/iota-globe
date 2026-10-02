"use client";

import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { REDUCED_MOTION } from "@/lib/motion";
import "lenis/dist/lenis.css";

const subscribe = (notify: () => void) => {
    const media = window.matchMedia(REDUCED_MOTION);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
};

function TickerBridge() {
    // ScrollTrigger reads Lenis's position, not the native one.
    useLenis(() => ScrollTrigger.update());
    return null;
}

// Lenis driven by the GSAP ticker so scroll and ScrollTrigger share a frame.
// Off under reduced motion.
export function SmoothScroll({ children }: { children: React.ReactNode }) {
    const lenisRef = useRef<LenisRef>(null);
    const reduced = useSyncExternalStore(
        subscribe,
        () => window.matchMedia(REDUCED_MOTION).matches,
        () => true
    );
    useEffect(() => {
        if (reduced) return;
        const update = (time: number) =>
            lenisRef.current?.lenis?.raf(time * 1000);
        gsap.ticker.add(update);
        gsap.ticker.lagSmoothing(0);
        return () => {
            gsap.ticker.remove(update);
            gsap.ticker.lagSmoothing(500, 33);
        };
    }, [reduced]);
    // Root mode: children don't remount when Lenis turns on after hydration.
    return (
        <>
            {!reduced && (
                <ReactLenis
                    root
                    ref={lenisRef}
                    options={{
                        autoRaf: false,
                        lerp: 0.11,
                        anchors: { offset: -64 },
                    }}
                >
                    <TickerBridge />
                </ReactLenis>
            )}
            {children}
        </>
    );
}
