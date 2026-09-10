"use client";

import { FormattedCell } from "@/components/FormattedCell";
import { ValidatorAvatar } from "@/components/ValidatorAvatar";
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
import {
    formatApy,
    formatCommissionRate,
    formatIota,
    shortString,
} from "@/lib/format";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useContext, useEffect, useState } from "react";
import { Validator, ValidatorsContext } from "./ValidatorsContext";

type SortKey =
    | "name"
    | "stake"
    | "apy"
    | "commission"
    | "votingPower"
    | "lastReward";

type Filter = "all" | "committee" | "active" | "at-risk";

const COLUMNS: {
    key: SortKey;
    label: string;
    align?: "left" | "center" | "right";
}[] = [
    { key: "name", label: "Validator", align: "left" },
    { key: "stake", label: "Stake", align: "right" },
    { key: "apy", label: "APY", align: "right" },
    { key: "commission", label: "Commission", align: "right" },
    { key: "votingPower", label: "Voting Power", align: "right" },
    { key: "lastReward", label: "Last Epoch Reward", align: "right" },
];

export default function ValidatorsTable({
    query,
    filter = "all",
}: {
    query: string;
    filter?: Filter;
}) {
    const { validators, isLoading, selectValidator } =
        useContext(ValidatorsContext);
    const initialLoading = isLoading && !validators.length;
    const { moveGlobeTo } = useContext(GlobeContext);
    const router = useRouter();
    const [sortKey, setSortKey] = useState<SortKey>("stake");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);
    const pageSize = 15;
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(0);
    }, [query, filter, sortKey, sortDir]);

    const filtered = validators.filter((v) => {
        if (
            ![v.payload.name, v.iotaAddress, v.geo?.country ?? ""].some(
                (value) =>
                    value.toLowerCase().includes(query.toLowerCase().trim())
            )
        ) {
            return false;
        }
        if (filter === "committee") return v.isCommitteeMember;
        if (filter === "active") return !v.isCommitteeMember;
        if (filter === "at-risk") return v.isAtRisk;
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

    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const visible = sorted.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
    );

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
        <>
            <Table className="relative h-fit w-full">
                <TableCaption className="sr-only">
                    Active IOTA validators. Select a validator to explore its
                    details.
                </TableCaption>
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
                                    sortDirection={sortDir}
                                    onClick={() => handleSort(key)}
                                />
                            );
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {initialLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <ValidatorRowSkeleton key={i} />
                        ))
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
                        visible.map((validator) => (
                            <ValidatorRow
                                key={validator.iotaAddress}
                                validator={validator}
                                onClick={handleRowClick}
                            />
                        ))
                    )}
                </TableBody>
            </Table>
            <div className="validator-pagination">
                <span>
                    {initialLoading
                        ? "Loading validators…"
                        : sorted.length
                          ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, sorted.length)} of ${sorted.length} validators`
                          : "0 validators"}
                </span>
                <div>
                    <button
                        className="icon-button"
                        aria-label="Previous validator page"
                        disabled={currentPage === 0 || initialLoading}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span>
                        Page {currentPage + 1} of {pageCount}
                    </span>
                    <button
                        className="icon-button"
                        aria-label="Next validator page"
                        disabled={
                            currentPage >= pageCount - 1 || initialLoading
                        }
                        onClick={() =>
                            setPage((p) => Math.min(pageCount - 1, p + 1))
                        }
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </>
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
    const lastReward = formatIota(stats.lastEpochRewardIOTA);
    const apy = formatApy(stats.apyPercent);
    const commission = formatCommissionRate(
        Number(payload.effectiveCommissionRate)
    );

    return (
        <TableRow
            onClick={() => onClick(validator)}
            tabIndex={0}
            aria-label={`View ${payload.name}`}
            onKeyDown={(event) => {
                if (event.key === "Enter") onClick(validator);
            }}
            className="cursor-pointer transition-colors"
        >
            <TableCell>
                <div className="flex items-center gap-3 font-medium">
                    <ValidatorAvatar
                        name={payload.name}
                        imageUrl={payload.imageUrl}
                    />
                    <div>
                        <span className="block text-xs">
                            {shortString(payload.name, 24)}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                            {validator.geo?.country ?? "Location unavailable"}
                            {validator.isAtRisk
                                ? " · At risk"
                                : validator.isCommitteeMember
                                  ? " · Committee"
                                  : ""}
                        </span>
                    </div>
                </div>
            </TableCell>
            <FormattedCell
                align="right"
                value={stake.value}
                label={stake.label}
            />
            <FormattedCell align="right" value={apy.value} label={apy.label} />
            <FormattedCell
                align="right"
                value={commission.value}
                label={commission.label}
            />
            <FormattedCell align="right" value={stats.stakePercent} label="%" />
            <FormattedCell
                align="right"
                value={lastReward.value}
                label={lastReward.label}
            />
        </TableRow>
    );
});

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
