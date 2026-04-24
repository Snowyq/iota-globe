"use client";

import { type ValidatorResponseItem } from "@/app/api/route";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { GlobeContext } from "./GlobeContext";
import { ValidatorsContext } from "@/features/iota/ValidatorsContext";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { cn } from "@/lib/utils";
import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";

function SelectedMarker({ validator }: { validator: ValidatorResponseItem }) {
    return (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 flex min-w-36 flex-col items-center gap-2 rounded-xl border border-primary/30 bg-card/85 p-3 shadow-lg shadow-primary/10 backdrop-blur-md">
            <img
                src={validator.payload.imageUrl}
                alt={validator.payload.name}
                className="h-9 w-9 rounded-full object-contain"
            />
            <span className="max-w-full truncate text-center text-xs font-medium">
                {validator.payload.name}
            </span>
        </div>
    );
}

export type ValidatorCluster = {
    id: string;
    lat: number;
    lng: number;
    count: number;
    validators: string[];
};

export const ClusterMarker = memo(function ClusterMarker({ cluster }: { cluster: ValidatorCluster }) {
    const { validators, selectValidator, deselectValidator, selectedValidator } =
        useContext(ValidatorsContext);
    const { moveGlobeTo, resetGlobe, getCanvas } = useContext(GlobeContext);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const justSelectedRef = useRef(false);
    const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const canvas = getCanvas();
            if (canvas) canvas.dispatchEvent(new WheelEvent("wheel", {
                deltaX: e.deltaX,
                deltaY: e.deltaY,
                deltaMode: e.deltaMode,
                bubbles: true,
            }));
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, [getCanvas]);

    const clusterValidators = useMemo(
        () => validators.filter((v) => cluster.validators.includes(v.iotaAddress)),
        [validators, cluster.validators]
    );

    const isSingle = cluster.count === 1;
    const isSelected =
        !!selectedValidator &&
        cluster.validators.includes(selectedValidator.iotaAddress);

    useClickOutside(wrapperRef, () => {
        deselectValidator?.();
        resetGlobe();
    }, isSelected);

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) return; // opening only via our delayed timeout
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current);
            openTimeoutRef.current = null;
        }
        setOpen(false);
        if (!justSelectedRef.current) resetGlobe();
        justSelectedRef.current = false;
    };

    const handleSingleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        selectValidator?.(cluster.validators[0]);
        moveGlobeTo(cluster.lat, cluster.lng, 0.8);
    };

    const handleClusterClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        moveGlobeTo(cluster.lat, cluster.lng);
        openTimeoutRef.current = setTimeout(() => setOpen(true), 1000);
    };

    const handleSelectFromPopover = (iotaAddress: string) => {
        justSelectedRef.current = true;
        selectValidator?.(iotaAddress);
        setOpen(false);
        const v = clusterValidators.find((v) => v.iotaAddress === iotaAddress);
        if (v?.geo) moveGlobeTo(v.geo.lat, v.geo.lon, 0.8);
    };

    if (isSingle && !clusterValidators[0]) return null;

    return (
        <div ref={wrapperRef} className={cn("relative", isSelected && "z-50")}>
            {isSelected && selectedValidator && (
                <SelectedMarker validator={selectedValidator} />
            )}
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "cursor-pointer bg-card/50! px-2 backdrop-blur-md transition-colors",
                            isSelected && "ring-2 ring-primary"
                        )}
                        onClick={isSingle ? handleSingleClick : handleClusterClick}
                    >
                        {isSingle ? (
                            <>
                                <img
                                    src={clusterValidators[0].payload.imageUrl}
                                    alt={clusterValidators[0].payload.name}
                                    className="aspect-square h-full object-contain"
                                    width={20}
                                    height={20}
                                />
                                <span className="text-muted-foreground">
                                    {clusterValidators[0].payload.name
                                        .slice(0, 3)
                                        .toUpperCase()}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">
                                {cluster.count}
                            </span>
                        )}
                    </Badge>
                </PopoverTrigger>

                {!isSingle && (
                    <PopoverContent className="w-56 p-2" align="center" side="top">
                        <p className="mb-1 px-2 text-xs text-muted-foreground">
                            {cluster.count} validators
                        </p>
                        <div className="max-h-48 overflow-y-auto">
                            {clusterValidators.map((v) => (
                                <button
                                    key={v.iotaAddress}
                                    onClick={() =>
                                        handleSelectFromPopover(v.iotaAddress)
                                    }
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                                        selectedValidator?.iotaAddress ===
                                            v.iotaAddress && "bg-primary/10 text-primary"
                                    )}
                                >
                                    <img
                                        src={v.payload.imageUrl}
                                        alt={v.payload.name}
                                        className="h-5 w-5 shrink-0 rounded-full object-contain"
                                    />
                                    <span className="truncate">{v.payload.name}</span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                )}
            </Popover>
        </div>
    );
});
