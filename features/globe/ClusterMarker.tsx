"use client";

import { type ValidatorResponseItem } from "@/app/api/validators/route";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useGlobeClickOutside } from "@/hooks/useGlobeClickOutside";
import { formatIota, formatNanoToIota } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Link } from "lucide-react";
import { useRouter } from "next/navigation";
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

function MarkerBase({
    children,
    className,
    validator,
}: {
    children: React.ReactNode;
    className?: string;
    validator: ValidatorResponseItem;
}) {
    const router = useRouter();
    const { payload, stats, iotaAddress, isCommitteeMember } = validator;

    const apyFormatted =
        stats.apyPercent != null ? `${stats.apyPercent.toFixed(2)}%` : "—";
    const commission =
        payload.effectiveCommissionRate != null
            ? `${(Number(payload.effectiveCommissionRate) / 100).toFixed(2)}%`
            : "—";
    const votingPower =
        payload.votingPower != null
            ? `${(Number(payload.votingPower) / 100).toFixed(2)}%`
            : "—";

    const totalStaked = formatNanoToIota(payload.stakingPoolIotaBalance);
    const rewardsPool = formatNanoToIota(payload.rewardsPool);
    const lastReward =
        stats.lastEpochRewardIOTA != null
            ? formatIota(stats.lastEpochRewardIOTA)
            : null;

    const nextEpochStake = formatNanoToIota(payload.nextEpochStake);
    const nextEpochCommission =
        payload.nextEpochCommissionRate != null
            ? `${(Number(payload.nextEpochCommissionRate) / 100).toFixed(2)}%`
            : "—";

    return (
        <Card
            size="sm"
            className="absolute bottom-[calc(100%+0.5rem)] left-1/2 w-fit -translate-x-1/2 cursor-pointer items-center backdrop-blur-sm transition-colors hover:bg-primary/20"
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
        <div ref={panelRef} className={cn(PANEL_STYLE, "w-48 overflow-hidden")}>
            <p className="px-3 pt-2.5 pb-1 text-[10px] text-muted-foreground">
                {validators.length} validators
            </p>
            <ScrollArea className="h-44">
                <div className="flex flex-col gap-px px-1.5 pb-1.5">
                    {validators.map((v) => (
                        <div
                            key={v.iotaAddress}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                                selectedAddress === v.iotaAddress
                                    ? "bg-primary/15 text-primary"
                                    : "hover:bg-muted/60"
                            )}
                        >
                            <button
                                onClick={() => onSelect(v.iotaAddress)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
                            >
                                {v.payload.imageUrl && (
                                    // eslint-disable-next-line
                                    <img
                                        src={v.payload.imageUrl}
                                        alt={v.payload.name}
                                        className="h-5 w-5 shrink-0 rounded-md object-contain"
                                    />
                                )}
                                <span className="truncate">
                                    {v.payload.name}
                                </span>
                            </button>
                            <Link
                                href={`/validators/${v.iotaAddress}`}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ArrowUpRight className="h-3 w-3" />
                            </Link>
                        </div>
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
    const { moveGlobeTo, startSpinning, zoomGlobe } = useContext(GlobeContext);
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
            data-globe-marker
            className="relative"
            style={{ transform: "translateZ(0)", touchAction: "manipulation" }}
        >
            {isSelected && selectedValidator && !open && (
                // <SelectedMarker validator={selectedValidator} />
                <MarkerBase validator={selectedValidator}>Hello</MarkerBase>
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
