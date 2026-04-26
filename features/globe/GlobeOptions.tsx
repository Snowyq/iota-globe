"use client";

import { Button } from "@/components/ui/button";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { OptionsContext } from "@/features/options/OptionsContext";
import { cn } from "@/lib/utils";
import { Crosshair, Maximize2, Minimize2 } from "lucide-react";
import { useContext } from "react";

export function GlobeOptions({ className }: { className?: string }) {
    const { resetGlobe } = useContext(GlobeContext);
    const { isFullscreen, canUseFullscreen, toggleFullscreen } = useContext(OptionsContext);

    return (
        <div className={cn("flex gap-2", className)}>
            <Button variant="secondary" size="icon" onClick={resetGlobe}>
                <Crosshair className="h-4 w-4" />
            </Button>
            {canUseFullscreen && (
                <Button variant="secondary" size="icon" onClick={toggleFullscreen}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
            )}
        </div>
    );
}
