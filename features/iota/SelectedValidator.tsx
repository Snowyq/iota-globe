"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { ValidatorsContext } from "@/features/iota/ValidatorsContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useContext } from "react";

export function SelectedValidator({ className }: { className?: string }) {
    const { selectedValidator, deselectValidator } = useContext(ValidatorsContext);
    const { resetGlobe } = useContext(GlobeContext);

    if (!selectedValidator) return null;

    const handleClose = () => {
        deselectValidator?.();
        resetGlobe();
    };

    return (
        <Card className={cn("z-10 w-full", className)}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-3">
                    {selectedValidator.payload.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={selectedValidator.payload.imageUrl}
                            alt={selectedValidator.payload.name}
                            className="h-10 w-10 rounded-full object-contain"
                        />
                    )}
                    <CardTitle className="text-base">{selectedValidator.payload.name}</CardTitle>
                </div>
                <button
                    onClick={handleClose}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Stake</span>
                    <span className="text-right font-medium text-foreground">
                        {selectedValidator.stats.stakeIOTA.toFixed(2)} M IOTA
                    </span>
                    <span>APY</span>
                    <span className="text-right font-medium text-foreground">
                        {selectedValidator.stats.apyPercent != null
                            ? `${selectedValidator.stats.apyPercent.toFixed(2)}%`
                            : "--"}
                    </span>
                    <span>Voting Power</span>
                    <span className="text-right font-medium text-foreground">
                        {selectedValidator.stats.stakePercent}%
                    </span>
                    {selectedValidator.stats.lastEpochRewardIOTA != null && (
                        <>
                            <span>Last Reward</span>
                            <span className="text-right font-medium text-foreground">
                                {selectedValidator.stats.lastEpochRewardIOTA.toFixed(2)} K IOTA
                            </span>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
