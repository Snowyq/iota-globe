"use client";

import { FormattedCell } from "@/components/FormattedCell";
import { TableHeaderCell } from "@/components/TableHeaderCell";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { formatIota } from "@/lib/format";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useContext, useState } from "react";
import { Validator, ValidatorsContext } from "./ValidatorsContext";

type SortKey =
    | "name"
    | "stake"
    | "apy"
    | "commission"
    | "votingPower"
    | "lastReward";

type Filter = "all" | "committee" | "active" | "pending" | "at-risk";

const COLUMNS: {
    key: SortKey;
    label: string;
    align?: "left" | "center" | "right";
}[] = [
    { key: "name", label: "Validator" },
    { key: "stake", label: "Stake", align: "right" },
    { key: "apy", label: "APY" },
    { key: "commission", label: "Commission", align: "right" },
    { key: "votingPower", label: "Voting Power", align: "right" },
    { key: "lastReward", label: "Last Epoch Reward", align: "right" },
];

function getSortValue(v: Validator, key: SortKey): number | string {
    switch (key) {
        case "name":
            return v.payload.name.toLowerCase();
        case "stake":
            return v.stats.stakeIOTA;
        case "apy":
            return v.stats.apyPercent ?? -Infinity;
        case "commission":
            return Number(v.payload.effectiveCommissionRate ?? 0);
        case "votingPower":
            return v.stats.stakePercent;
        case "lastReward":
            return v.stats.lastEpochRewardIOTA ?? -Infinity;
    }
}

export default function ValidatorsTable({
    query,
    filter = "all",
}: {
    query: string;
    filter?: Filter;
}) {
    const { validators, isLoading, selectValidator } =
        useContext(ValidatorsContext);
    const { moveGlobeTo } = useContext(GlobeContext);
    const router = useRouter();
    const [sortKey, setSortKey] = useState<SortKey>("stake");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const filtered = validators.filter((v) => {
        if (!v.payload.name.toLowerCase().includes(query.toLowerCase())) {
            return false;
        }
        if (filter === "committee") return v.isCommitteeMember;
        if (filter === "active") return !v.isCommitteeMember;
        if (filter === "at-risk") return v.isAtRisk;
        if (filter === "pending") return false;
        return true;
    });
    const sorted = [...filtered].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        const cmp =
            typeof av === "string"
                ? av.localeCompare(bv as string)
                : (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
    });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const handleRowClick = useCallback(
        (validator: Validator) => {
            selectValidator?.(validator.iotaAddress);
            if (validator.geo) {
                const { lat, lon } = validator.geo;
                setTimeout(() => moveGlobeTo(lat, lon, 0.8), 0);
            }
            router.push(`/validators/${validator.iotaAddress}`);
        },
        [selectValidator, moveGlobeTo, router]
    );

    return (
        <Table className="relative h-fit w-full">
            <TableCaption>IOTA validators.</TableCaption>
            <TableHeader>
                <TableRow className="hover:bg-transparent!">
                    {COLUMNS.map(({ key, label, align }) => {
                        const active = sortKey === key;
                        return (
                            <TableHeaderCell
                                key={key}
                                label={label}
                                align={align}
                                icon={
                                    active
                                        ? sortDir === "asc"
                                            ? ArrowUp
                                            : ArrowDown
                                        : ArrowUpDown
                                }
                                iconActive={active}
                                onClick={() => handleSort(key)}
                            />
                        );
                    })}
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <ValidatorRowSkeleton key={i} />
                    ))
                ) : filter === "pending" ? (
                    <TableRow>
                        <TableCell
                            colSpan={6}
                            className="py-10 text-center text-sm text-muted-foreground"
                        >
                            Pending validator details are not available via
                            public RPC.
                        </TableCell>
                    </TableRow>
                ) : sorted.length === 0 ? (
                    <TableRow>
                        <TableCell
                            colSpan={6}
                            className="py-10 text-center text-sm text-muted-foreground"
                        >
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

function ValidatorRowSkeleton() {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </TableCell>
            <TableCell>
                <Skeleton className="h-3 w-16" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-3 w-12" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-3 w-12" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-3 w-10" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-3 w-16" />
            </TableCell>
        </TableRow>
    );
}

const ValidatorRow = memo(function ValidatorRow({
    validator,
    onClick,
}: {
    validator: Validator;
    onClick: (v: Validator) => void;
}) {
    const { stats, payload } = validator;
    const stake = formatIota(stats.stakeIOTA);
    const lastReward =
        stats.lastEpochRewardIOTA != null
            ? formatIota(stats.lastEpochRewardIOTA)
            : { value: null, label: "IOTA" };

    return (
        <TableRow
            onClick={() => onClick(validator)}
            className="cursor-pointer transition-colors"
        >
            <TableCell className="flex items-center gap-2 font-medium">
                {payload.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={payload.imageUrl}
                        alt={payload.name}
                        className="h-8 w-8 object-contain"
                        width={20}
                        height={20}
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-200">
                        {payload.name.slice(0, 1)}
                    </div>
                )}
                <span className="text-xs">{payload.name}</span>
            </TableCell>
            <FormattedCell
                align="right"
                value={stake.value}
                label={stake.label}
            />
            <FormattedCell align="right" value={formatApy(stats.apyPercent)} />
            <FormattedCell
                align="right"
                value={formatEffectiveCommissionRate(
                    Number(payload.effectiveCommissionRate)
                )}
            />
            <FormattedCell align="right" value={`${stats.stakePercent}%`} />
            <FormattedCell
                align="right"
                value={lastReward.value}
                label={lastReward.label}
            />
        </TableRow>
    );
});

function formatApy(apy: number | null): string | null {
    return apy != null ? `${apy.toFixed(2)}%` : "-";
}

function formatEffectiveCommissionRate(
    rate: number | null | undefined
): string {
    return rate != null ? `${(rate / 100).toFixed(2)}%` : "-";
}
