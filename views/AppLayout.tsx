"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeOptions } from "@/features/globe/GlobeOptions";
import { OptionsContext } from "@/features/options/OptionsContext";
import { SelectedValidator } from "@/features/validators/SelectedValidator";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import IndexFullscreen from "./IndexFullscreen";

const PANEL_WIDTH = 380;
const GLOBE_OFFSET: [number, number] = [PANEL_WIDTH / 2, 0];

function GlobeWithControls({ panelFullscreen }: { panelFullscreen: boolean }) {
    return (
        <div
            className={cn(
                "relative w-screen transition-[height,max-height] duration-500 ease-in-out",
                panelFullscreen ? "h-svh max-h-svh" : "h-[75vh] max-h-200"
            )}
        >
            <div className="absolute inset-0 overflow-hidden">
                <GlobeNoSSR
                    className=""
                    variant="home"
                    globeOffset={panelFullscreen ? GLOBE_OFFSET : [0, 0]}
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
                    ? "fixed top-[var(--nav-height)] bottom-0 left-0 w-150 bg-background/70 backdrop-blur-md"
                    : "relative -mt-20 w-full pt-px"
            )}
        >
            {panelFullscreen ? (
                <ScrollArea className="h-full">
                    <div className="@container px-4 py-6">
                        {fullscreenSlot ?? children}
                    </div>
                </ScrollArea>
            ) : (
                <>
                    <div className="absolute inset-x-0 top-0 -z-10 h-20 bg-linear-to-b from-background/0 to-background" />
                    <div className="@container section py-8">{children}</div>
                </>
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
        setContentVisible(false);
        const t = setTimeout(() => {
            setPanelFullscreen(isFullscreen);
            setContentVisible(true);
        }, 180);
        return () => clearTimeout(t);
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
