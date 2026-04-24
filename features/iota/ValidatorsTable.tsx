"use client";

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { memo, useCallback, useContext, useMemo, useState } from "react";
import { Validator, ValidatorsContext } from "./ValidatorsContext";

type SortKey = "name" | "stake" | "apy" | "commission" | "votingPower" | "lastReward";

const COLUMNS: { key: SortKey; label: string }[] = [
    { key: "name",        label: "Validator" },
    { key: "stake",       label: "Stake" },
    { key: "apy",         label: "APY" },
    { key: "commission",  label: "Effective Commission" },
    { key: "votingPower", label: "Voting Power" },
    { key: "lastReward",  label: "Last Epoch Reward" },
];

function getSortValue(v: Validator, key: SortKey): number | string {
    switch (key) {
        case "name":        return v.payload.name.toLowerCase();
        case "stake":       return v.stats.stakeIOTA;
        case "apy":         return v.stats.apyPercent ?? -Infinity;
        case "commission":  return Number(v.payload.effectiveCommissionRate ?? 0);
        case "votingPower": return v.stats.stakePercent;
        case "lastReward":  return v.stats.lastEpochRewardIOTA ?? -Infinity;
    }
}

export default function ValidatorsTable({ query }: { query: string }) {
    const { validators, isLoading, selectValidator } = useContext(ValidatorsContext);
    const { moveGlobeTo } = useContext(GlobeContext);

    const [sortKey, setSortKey] = useState<SortKey>("stake");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const sorted = useMemo(() =>
        [...validators]
            .filter((v) => v.payload.name.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => {
                const av = getSortValue(a, sortKey);
                const bv = getSortValue(b, sortKey);
                const cmp = typeof av === "string"
                    ? av.localeCompare(bv as string)
                    : (av as number) - (bv as number);
                return sortDir === "asc" ? cmp : -cmp;
            }),
        [validators, query, sortKey, sortDir]
    );

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("desc"); }
    };

    const handleRowClick = useCallback((validator: Validator) => {
        selectValidator?.(validator.iotaAddress);
        if (validator.geo) moveGlobeTo(validator.geo.lat, validator.geo.lon, 0.8);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [selectValidator, moveGlobeTo]);

    return (
        <Table className="relative w-full">
            <TableCaption>Active IOTA validators.</TableCaption>
            <TableHeader>
                <TableRow className="hover:bg-transparent!">
                    {COLUMNS.map(({ key, label }) => {
                        const active = sortKey === key;
                        const Icon = active
                            ? sortDir === "asc" ? ArrowUp : ArrowDown
                            : ArrowUpDown;
                        return (
                            <TableCell
                                key={key}
                                onClick={() => handleSort(key)}
                                className="cursor-pointer select-none text-xs text-muted-foreground"
                            >
                                <span className="flex items-center gap-1">
                                    {label}
                                    <Icon className={cn("h-3 w-3", active ? "text-foreground" : "opacity-40")} />
                                </span>
                            </TableCell>
                        );
                    })}
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse">
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                    <div className="h-3 w-24 rounded bg-muted" />
                                </div>
                            </TableCell>
                            <TableCell><div className="h-3 w-16 rounded bg-muted" /></TableCell>
                            <TableCell><div className="h-3 w-12 rounded bg-muted" /></TableCell>
                            <TableCell><div className="h-3 w-12 rounded bg-muted" /></TableCell>
                            <TableCell><div className="h-3 w-10 rounded bg-muted" /></TableCell>
                            <TableCell><div className="h-3 w-16 rounded bg-muted" /></TableCell>
                        </TableRow>
                    ))
                ) : sorted.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            No validators found.
                        </TableCell>
                    </TableRow>
                ) : (
                    sorted.map((validator) => (
                        <ValidatorRow
                            key={validator.iotaAddress}
                            validator={validator}
                            onClick={handleRowClick}
                        />
                    ))
                )}
            </TableBody>
        </Table>
    );
}

const ValidatorRow = memo(function ValidatorRow({
    validator,
    onClick,
}: {
    validator: Validator;
    onClick: (v: Validator) => void;
}) {
    return (
        <TableRow onClick={() => onClick(validator)} className="cursor-pointer transition-colors">
            <TableCell className="flex items-center gap-2 font-medium">
                {validator.payload.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={validator.payload.imageUrl}
                        alt={validator.payload.name}
                        className="h-8 w-8 object-contain"
                        width={20}
                        height={20}
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-200">
                        {validator.payload.name.slice(0, 1)}
                    </div>
                )}
                <span className="text-xs">{validator.payload.name}</span>
            </TableCell>
            <TableCell className="font-medium">
                {validator.stats.stakeIOTA.toFixed(2)}
                <span className="text-[10px] text-muted-foreground"> M IOTA</span>
            </TableCell>
            <TableCell className="font-medium">
                {validator.stats.apyPercent != null
                    ? `${validator.stats.apyPercent.toFixed(2)}%`
                    : "--"}
            </TableCell>
            <TableCell className="font-medium">
                {(Number(validator.payload.effectiveCommissionRate ?? 0) / 100).toFixed(2)}%
            </TableCell>
            <TableCell className="font-medium">
                {validator.stats.stakePercent}%
            </TableCell>
            <TableCell className="font-medium">
                {validator.stats.lastEpochRewardIOTA != null
                    ? `${validator.stats.lastEpochRewardIOTA.toFixed(2)} K`
                    : "N/A"}
                <span className="text-[10px] text-muted-foreground"> IOTA</span>
            </TableCell>
        </TableRow>
    );
});
