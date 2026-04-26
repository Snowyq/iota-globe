"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeOptions } from "@/features/globe/GlobeOptions";
import { OptionsContext } from "@/features/options/OptionsContext";
import { SelectedValidator } from "@/features/validators/SelectedValidator";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import IndexFullscreen from "./IndexFullscreen";

const PANEL_WIDTH = 380;
const GLOBE_OFFSET: [number, number] = [PANEL_WIDTH / 2, 0];
const GLOBE_CENTER_OFFSET_Y = 0;

function GlobeWithControls({ panelFullscreen }: { panelFullscreen: boolean }) {
    const outerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [offsets, setOffsets] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        const update = () => {
            const outer = outerRef.current;
            const canvas = canvasRef.current;
            if (!outer || !canvas) return;
            const sy = window.scrollY;
            const nav = document.querySelector("header");
            const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
            const outerBottom = outer.getBoundingClientRect().bottom + sy;
            const visibleCenter = (navBottom + outerBottom) / 2;
            const canvasRect = canvas.getBoundingClientRect();
            const canvasCenter = canvasRect.top + sy + canvasRect.height / 2;
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
                panelFullscreen ? "h-svh" : "h-[60vh] max-h-200 sm:h-[60vh]"
            )}
        >
            <div
                ref={canvasRef}
                className="absolute inset-0 overflow-hidden md:bottom-auto md:h-dvh md:overflow-visible"
            >
                <GlobeNoSSR
                    className=""
                    variant="home"
                    globeOffset={panelFullscreen ? GLOBE_OFFSET : offsets}
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
    contentVisible,
    fullscreenSlot,
    children,
}: {
    panelFullscreen: boolean;
    contentVisible: boolean;
    fullscreenSlot?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "z-20 transition-opacity duration-180",
                contentVisible ? "opacity-100" : "opacity-0",
                panelFullscreen
                    ? "fixed top-(--nav-height) bottom-0 left-0 w-200 bg-linear-to-r from-background/70 to-background/20 backdrop-blur-lg"
                    : "relative w-full"
            )}
            style={
                panelFullscreen
                    ? {
                          maskImage:
                              "linear-gradient(to left, transparent, black 6rem)",
                          WebkitMaskImage:
                              "linear-gradient(to left, transparent, black 6rem)",
                      }
                    : undefined
            }
        >
            {panelFullscreen ? (
                <ScrollArea className="h-full">
                    <div className="@container px-4 py-6">
                        {fullscreenSlot ?? children}
                    </div>
                </ScrollArea>
            ) : (
                <>{children}</>
            )}
        </div>
    );
}

function SelectedValidatorPanel({
    contentVisible,
}: {
    contentVisible: boolean;
}) {
    return (
        <div
            className={cn(
                "fixed right-4 bottom-8 z-20 w-72 transition-opacity duration-300 sm:right-5 xl:right-10",
                contentVisible ? "opacity-100" : "opacity-0"
            )}
        >
            <SelectedValidator />
        </div>
    );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { isFullscreen } = useContext(OptionsContext);
    const pathname = usePathname();

    const [contentVisible, setContentVisible] = useState(true);
    const [panelFullscreen, setPanelFullscreen] = useState(isFullscreen);

    const fullscreenSlot = pathname === "/" ? <IndexFullscreen /> : undefined;

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
            <GlobeWithControls panelFullscreen={panelFullscreen} />
            <PagePanel
                panelFullscreen={panelFullscreen}
                contentVisible={contentVisible}
                fullscreenSlot={fullscreenSlot}
            >
                {children}
            </PagePanel>
            {panelFullscreen && (
                <SelectedValidatorPanel contentVisible={contentVisible} />
            )}
        </div>
    );
}
