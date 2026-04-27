"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeOptions } from "@/features/globe/GlobeOptions";
import { OptionsContext } from "@/features/options/OptionsContext";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { IndexFullscreenPanel } from "./Index";

const GLOBE_CENTER_OFFSET_Y = 0;

function GlobeWithControls({
    panelFullscreen,
    globeOffsetX,
}: {
    panelFullscreen: boolean;
    globeOffsetX: number;
}) {
    const outerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [offsets, setOffsets] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        const update = () => {
            const outer = outerRef.current;
            const canvas = canvasRef.current;
            if (!outer || !canvas) return;
            const scrollY = window.scrollY;
            const nav = document.querySelector("header");
            const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
            const outerBottom = outer.getBoundingClientRect().bottom + scrollY;
            const visibleCenter = (navBottom + outerBottom) / 2;
            const canvasRect = canvas.getBoundingClientRect();
            const canvasCenter =
                canvasRect.top + scrollY + canvasRect.height / 2;
            setOffsets([
                0,
                visibleCenter - canvasCenter + GLOBE_CENTER_OFFSET_Y,
            ]);
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(document.documentElement);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={outerRef}
            className={cn(
                "relative w-screen transition-[height] duration-500 ease-in-out",
                panelFullscreen ? "h-svh" : "h-[65vh] max-h-200 sm:h-[60vh]"
            )}
        >
            <div
                ref={canvasRef}
                className={cn(
                    "absolute inset-0 overflow-hidden after:pointer-events-none md:bottom-auto md:h-dvh md:overflow-visible",
                    !panelFullscreen &&
                        "after:absolute after:inset-x-0 after:bottom-0 after:h-[15vh] after:max-h-200 after:bg-linear-to-b after:from-background/0 after:via-background/90 after:via-50% after:to-background after:[content:''] after:sm:h-[45vh]"
                )}
            >
                <GlobeNoSSR
                    className=""
                    variant="home"
                    globeOffset={panelFullscreen ? [globeOffsetX, 0] : offsets}
                    targetAltitude={panelFullscreen ? 2.5 : 4.5}
                />
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--nav-height)+2rem)] bottom-0 z-20">
                <GlobeOptions className="pointer-events-auto absolute right-4 flex-col sm:right-5 xl:right-10" />
            </div>
        </div>
    );
}

function PagePanel({
    panelFullscreen,
    narrow,
    contentVisible,
    fullscreenSlot,
    panelRef,
    children,
}: {
    panelFullscreen: boolean;
    narrow: boolean;
    contentVisible: boolean;
    fullscreenSlot?: React.ReactNode;
    panelRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode;
}) {
    return (
        <div
            ref={panelRef}
            className={cn(
                "z-20 transition-opacity duration-180",
                contentVisible ? "opacity-100" : "opacity-0",
                panelFullscreen
                    ? cn(
                          "fixed top-(--nav-height) bottom-0 left-0",
                          narrow
                              ? "w-100"
                              : "w-200 bg-background/50 backdrop-blur-xs"
                      )
                    : "relative w-full"
            )}
        >
            {panelFullscreen ? (
                (fullscreenSlot ?? (
                    <ScrollArea className="h-full">
                        <div className="@container py-6">{children}</div>
                    </ScrollArea>
                ))
            ) : (
                <>{children}</>
            )}
        </div>
    );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { isFullscreen } = useContext(OptionsContext);
    const pathname = usePathname();
    const [contentVisible, setContentVisible] = useState(true);
    const [panelFullscreen, setPanelFullscreen] = useState(isFullscreen);
    const panelRef = useRef<HTMLDivElement>(null);
    const [globeOffsetX, setGlobeOffsetX] = useState(0);

    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => {
            setGlobeOffsetX(el.offsetWidth / 2);
        });
        observer.observe(el);
        setGlobeOffsetX(el.offsetWidth / 2);
        return () => observer.disconnect();
    }, [panelFullscreen]);

    const isIndexFullscreen = pathname === "/" && panelFullscreen;

    const fullscreenSlot = isIndexFullscreen ? (
        <IndexFullscreenPanel />
    ) : undefined;

    useEffect(() => {
        const t1 = setTimeout(() => setContentVisible(false), 0);
        const t2 = setTimeout(() => {
            setPanelFullscreen(isFullscreen);
            setContentVisible(true);
        }, 180);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [isFullscreen]);

    return (
        <div
            className={cn(
                "bg-background transition-[height] duration-500",
                panelFullscreen
                    ? "h-svh overflow-hidden"
                    : "min-h-svh overflow-x-hidden"
            )}
        >
            <GlobeWithControls
                panelFullscreen={panelFullscreen}
                globeOffsetX={globeOffsetX}
            />
            <PagePanel
                panelFullscreen={panelFullscreen}
                narrow={isIndexFullscreen}
                contentVisible={contentVisible}
                fullscreenSlot={fullscreenSlot}
                panelRef={panelRef}
            >
                {children}
            </PagePanel>
            {isIndexFullscreen && (
                <div
                    id="globe-bottom-portal"
                    className={cn(
                        "pointer-events-none fixed right-0 bottom-0 left-100 z-20 transition-opacity duration-180",
                        contentVisible ? "opacity-100" : "opacity-0"
                    )}
                />
            )}
        </div>
    );
}
