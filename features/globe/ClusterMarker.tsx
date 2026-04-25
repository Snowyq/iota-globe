"use client";

import { type ValidatorResponseItem } from "@/app/api/validators/route";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
    memo,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { GlobeContext } from "./GlobeContext";

const PANEL_STYLE =
    "absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-primary/30 bg-card/80 shadow-lg shadow-primary/10 backdrop-blur-md";

function SelectedMarker({ validator }: { validator: ValidatorResponseItem }) {
    return (
        <Link
            href={`/validator/${validator.iotaAddress}`}
            className={cn(
                PANEL_STYLE,
                "flex min-w-36 flex-col items-center gap-2 overflow-hidden p-3 transition-opacity hover:opacity-80"
            )}
        >
            {validator.payload.imageUrl && (
                // eslint-disable-next-line
                <img
                    src={validator.payload.imageUrl}
                    alt={validator.payload.name}
                    className="h-9 w-9 rounded-md object-contain"
                />
            )}
            <span className="max-w-35 truncate text-center text-xs font-medium">
                {validator.payload.name}
            </span>
        </Link>
    );
}

function ClusterPanel({
    validators,
    selectedAddress,
    onSelect,
    panelRef,
}: {
    validators: ValidatorResponseItem[];
    selectedAddress?: string;
    onSelect: (addr: string) => void;
    panelRef: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div ref={panelRef} className={cn(PANEL_STYLE, "w-48 overflow-hidden")}>
            <p className="px-3 pt-2.5 pb-1 text-[10px] text-muted-foreground">
                {validators.length} validators
            </p>
            <ScrollArea className="h-44">
                <div className="flex flex-col gap-px px-1.5 pb-1.5">
                    {validators.map((v) => (
                        <button
                            key={v.iotaAddress}
                            onClick={() => onSelect(v.iotaAddress)}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors outline-none hover:bg-muted/60",
                                selectedAddress === v.iotaAddress &&
                                    "bg-primary/15 text-primary"
                            )}
                        >
                            {v.payload.imageUrl && (
                                // eslint-disable-next-line
                                <img
                                    src={v.payload.imageUrl}
                                    alt={v.payload.name}
                                    className="h-5 w-5 shrink-0 rounded-md object-contain"
                                />
                            )}
                            <span className="truncate">{v.payload.name}</span>
                        </button>
                    ))}
                </div>
            </ScrollArea>
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

export const ClusterMarker = memo(function ClusterMarker({
    cluster,
}: {
    cluster: ValidatorCluster;
}) {
    const {
        validators,
        selectValidator,
        deselectValidator,
        selectedValidator,
    } = useContext(ValidatorsContext);
    const { moveGlobeTo, resetGlobe, zoomGlobe } = useContext(GlobeContext);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (panelRef.current?.contains(e.target as Node)) return;
            e.preventDefault();
            zoomGlobe(e.deltaY);
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, [zoomGlobe]);

    const clusterValidators = useMemo(
        () =>
            validators.filter((v) =>
                cluster.validators.includes(v.iotaAddress)
            ),
        [validators, cluster.validators]
    );

    const isSingle = cluster.count === 1;
    const isSelected =
        !!selectedValidator &&
        cluster.validators.includes(selectedValidator.iotaAddress);

    useEffect(() => {
        const globeWrapper = wrapperRef.current?.parentElement?.parentElement;
        if (!globeWrapper) return;
        globeWrapper.style.zIndex = isSelected || open ? "9999" : "";
    }, [isSelected, open]);

    useClickOutside(
        wrapperRef,
        () => {
            setOpen(false);
            deselectValidator?.();
            resetGlobe();
        },
        isSelected || open
    );

    const handleSingleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        selectValidator?.(cluster.validators[0]);
        moveGlobeTo(cluster.lat, cluster.lng);
    };

    const handleClusterClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (open) {
            setOpen(false);
            return;
        }
        moveGlobeTo(cluster.lat, cluster.lng);
        setOpen(true);
    };

    const handleSelectFromPanel = useCallback(
        (iotaAddress: string) => {
            selectValidator?.(iotaAddress);
            setOpen(false);
            const v = clusterValidators.find(
                (v) => v.iotaAddress === iotaAddress
            );
            if (v?.geo) moveGlobeTo(v.geo.lat, v.geo.lon);
        },
        [selectValidator, clusterValidators, moveGlobeTo]
    );

    if (isSingle && !clusterValidators[0]) return null;

    return (
        <div
            ref={wrapperRef}
            className="relative"
            style={{ transform: "translateZ(0)", touchAction: "manipulation" }}
        >
            {isSelected && selectedValidator && !open && (
                <SelectedMarker validator={selectedValidator} />
            )}
            {!isSingle && open && (
                <ClusterPanel
                    validators={clusterValidators}
                    selectedAddress={selectedValidator?.iotaAddress}
                    onSelect={handleSelectFromPanel}
                    panelRef={panelRef}
                />
            )}
            <Badge
                variant={isSelected ? "default" : "secondary"}
                className={cn(
                    "cursor-pointer px-2 backdrop-blur-md transition-colors",
                    !isSelected && "bg-card/50!"
                )}
                onClick={isSingle ? handleSingleClick : handleClusterClick}
            >
                {isSelected && selectedValidator ? (
                    <>
                        <img
                            src={selectedValidator.payload.imageUrl}
                            alt={selectedValidator.payload.name}
                            className="aspect-square h-full object-contain"
                            width={20}
                            height={20}
                        />
                        <span className="text-primary-foreground">
                            {selectedValidator.payload.name
                                .slice(0, 3)
                                .toUpperCase()}
                        </span>
                    </>
                ) : isSingle ? (
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
        </div>
    );
});
