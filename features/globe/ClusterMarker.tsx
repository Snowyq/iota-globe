"use client";

import { type ValidatorResponseItem } from "@/app/api/validators/route";
import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useGlobeClickOutside } from "@/hooks/useGlobeClickOutside";
import { formatNanoToIota } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { GlobeContext } from "./GlobeContext";

export type ValidatorCluster = {
    id: string;
    lat: number;
    lng: number;
    count: number;
    validators: string[];
};

export function ClusterMarker({ cluster }: { cluster: ValidatorCluster }) {
    const {
        validators,
        selectValidator,
        deselectValidator,
        selectedValidator,
    } = useContext(ValidatorsContext);
    const {
        moveGlobeTo,
        startSpinning,
        zoomGlobe,
        openClusterId,
        setOpenClusterId,
    } = useContext(GlobeContext);
    const open = openClusterId === cluster.id;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const setOpen = useCallback(
        (val: boolean) => setOpenClusterId(val ? cluster.id : null),
        [cluster.id, setOpenClusterId]
    );

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

    // Block globe zoom when scrolling inside the cluster panel
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const handler = (e: WheelEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const viewport = panel.querySelector(
                "[data-radix-scroll-area-viewport]"
            );
            if (viewport) viewport.scrollTop += e.deltaY;
        };
        panel.addEventListener("wheel", handler, {
            passive: false,
            capture: true,
        });
        return () =>
            panel.removeEventListener("wheel", handler, { capture: true });
    }, []);

    useEffect(() => {
        if (
            open &&
            selectedValidator &&
            !cluster.validators.includes(selectedValidator.iotaAddress)
        ) {
            setOpen(false);
        }
    }, [selectedValidator, open, cluster.validators, setOpen]);

    useEffect(() => {
        const globeWrapper = wrapperRef.current?.parentElement?.parentElement;
        if (!globeWrapper) return;
        globeWrapper.style.zIndex = isSelected || open ? "9999" : "";
    }, [isSelected, open]);

    useGlobeClickOutside(
        wrapperRef,
        () => {
            setOpen(false);
            deselectValidator?.();
            startSpinning();
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
        deselectValidator?.();
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
        [selectValidator, clusterValidators, moveGlobeTo, setOpen]
    );

    if (isSingle && !clusterValidators[0]) return null;

    return (
        <div
            ref={wrapperRef}
            data-globe-marker
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
            <div
                className={cn(
                    "flex cursor-pointer gap-2 rounded-full border-2 border-border/20 px-2 py-0.5 backdrop-blur-md transition-colors lg:px-3 lg:py-1",
                    !isSelected && !open && "bg-card/70",
                    (isSelected || open) &&
                        "border-foreground/30 bg-primary/50!"
                )}
                onClick={isSingle ? handleSingleClick : handleClusterClick}
            >
                {isSingle ? (
                    <>
                        <img
                            src={clusterValidators[0].payload.imageUrl}
                            alt={clusterValidators[0].payload.name}
                            className="aspect-square h-full rounded-full bg-foreground/20 object-contain p-px"
                            width={20}
                            height={20}
                        />
                        <span className="text-sm text-foreground">
                            {clusterValidators[0].payload.name
                                .slice(0, 3)
                                .toUpperCase()}
                        </span>
                    </>
                ) : (
                    <span
                        className={cn(
                            "text-muted-foreground",
                            (isSelected || open) && "text-foreground"
                        )}
                    >
                        {cluster.count}
                    </span>
                )}
            </div>
        </div>
    );
}

function SelectedMarker({ validator }: { validator: ValidatorResponseItem }) {
    const router = useRouter();
    const { payload, iotaAddress } = validator;

    const totalStaked = formatNanoToIota(payload.stakingPoolIotaBalance);

    return (
        <Card
            size="sm"
            className="absolute bottom-[calc(100%+0.5rem)] left-1/2 w-35 -translate-x-1/2 cursor-pointer items-center gap-1! backdrop-blur-sm transition-colors hover:bg-primary/20"
            onClick={() => router.push(`/validators/${iotaAddress}`)}
        >
            <CardHeader className="relative w-full">
                <div className="absolute top-0 right-2">
                    <ArrowUpRight className="h-3 w-3" />
                </div>
                <div className="flex w-full flex-col items-center gap-2">
                    {validator.payload.imageUrl && (
                        <div className="">
                            <img
                                src={validator.payload.imageUrl}
                                alt={validator.payload.name}
                                className="aspect-square h-10 w-10 rounded-sm object-contain"
                            />
                        </div>
                    )}
                    <CardTitle className="w-20 truncate text-center text-xs font-medium">
                        {validator.payload.name}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex gap-2">
                <div className="flex flex-col gap-2 text-nowrap!">
                    {/* <Stat
                        size={"xs"}
                        value={votingPower}
                        label="Voting Power"
                    /> */}
                    <Stat
                        size={"xs"}
                        value={totalStaked.value}
                        sub={totalStaked.label}
                        label="Total Staked"
                    />
                </div>
            </CardContent>
        </Card>
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
        <Card
            ref={panelRef}
            size="sm"
            className="absolute bottom-[calc(100%+0.5rem)] left-1/2 w-50 -translate-x-1/2 cursor-pointer items-center gap-1! border-2 border-border/20 backdrop-blur-sm transition-colors"
        >
            <CardHeader className="relative w-full">
                <CardTitle className="text-center text-xs font-medium">
                    {validators.length} Validators
                </CardTitle>
            </CardHeader>
            <CardContent className="flex w-full gap-2">
                <ScrollArea
                    className={cn(
                        "w-full",
                        validators.length < 4 ? "h-fit" : "h-30"
                    )}
                >
                    <div className="flex w-full flex-col gap-px px-1.5 pb-1.5">
                        {validators.map((v) => (
                            <div
                                key={v.iotaAddress}
                                className={cn(
                                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                                    selectedAddress === v.iotaAddress
                                        ? "bg-primary/15 text-primary"
                                        : "hover:bg-primary/20"
                                )}
                                onClick={() => onSelect(v.iotaAddress)}
                            >
                                <div className="flex items-center gap-2">
                                    {v.payload.imageUrl && (
                                        // eslint-disable-next-line
                                        <img
                                            src={v.payload.imageUrl}
                                            alt={v.payload.name}
                                            className="p-x h-5 w-5 shrink-0 rounded-md object-contain"
                                        />
                                    )}
                                    <span className="w-full truncate">
                                        {v.payload.name}
                                    </span>
                                </div>
                                <ArrowUpRight className="h-3 w-3" />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
