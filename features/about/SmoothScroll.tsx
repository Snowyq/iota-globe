"use client";

import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import "lenis/dist/lenis.css";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
};

function TickerBridge() {
    // ScrollTrigger reads Lenis's position, not the native one.
    useLenis(() => ScrollTrigger.update());
    return null;
}

// Smooth scrolling for this page only, driven by GSAP's ticker so scroll
// and scroll-linked animation advance on the same frame. Off under reduced
// motion.
export function SmoothScroll({ children }: { children: React.ReactNode }) {
    const lenisRef = useRef<LenisRef>(null);
    const reduced = useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
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
    // Root mode attaches to the window, so the page itself never moves
    // in the tree when smooth scrolling switches on after hydration.
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
