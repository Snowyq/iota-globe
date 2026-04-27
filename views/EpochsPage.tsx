"use client";

import { EpochRow, EpochsApiResponse, PAGE_SIZE } from "@/app/api/epochs/route";
import { FormattedCell } from "@/components/FormattedCell";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import {
    TableHeaderCellProps as ColDef,
    TableHeaderCell,
} from "@/components/TableHeaderCell";
import { Input } from "@/components/ui/input";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { OptionsContext } from "@/features/options/OptionsContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { formatDuration, formatNanoToIota } from "@/lib/format";
import { useContext, useEffect, useState } from "react";

const COLS: ColDef[] = [
    { label: "Epoch" },
    { label: "Transaction Blocks", align: "right" },
    { label: "Stake Rewards", align: "right" },
    { label: "Checkpoint Set", align: "right" },
    { label: "Storage Net Inflow", align: "right" },
    { label: "Epoch End", align: "right" },
];

export default function EpochsPage() {
    const { network } = useContext(OptionsContext);
    const { networkStats } = useContext(ValidatorsContext);

    const currentEpoch =
        networkStats?.epoch != null ? Number(networkStats.epoch) : null;
    const totalPages =
        currentEpoch != null ? Math.ceil((currentEpoch + 1) / PAGE_SIZE) : 1;

    const [epochs, setEpochs] = useState<EpochRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);

    const now = useNowTime();

    useOnNetworkChange(() => {
        setPageIndex(0);
        setHasNextPage(false);
    });

    useEffect(() => {
        const cursor =
            pageIndex === 0 || currentEpoch == null
                ? null
                : String(currentEpoch - pageIndex * PAGE_SIZE);

        const url = `/api/epochs?dataset=${network}${cursor ? `&cursor=${cursor}` : ""}`;

        setIsLoading(true);
        fetch(url)
            .then((r) => r.json() as Promise<EpochsApiResponse>)
            .then(({ epochs, hasNextPage }) => {
                setEpochs(epochs);
                setHasNextPage(hasNextPage);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [network, pageIndex, currentEpoch]);

    const goToPage = (p: number) => {
        const clamped = Math.max(0, Math.min(p, totalPages - 1));
        setPageIndex(clamped);
    };

    return (
        <Page className="">
            <PageHeader title="Epochs" description="Recent epoch statistics" />

            <Table className="w-full">
                <TableCaption>IOTA epoch history.</TableCaption>
                <TableHeader className="">
                    <TableRow className="hover:bg-transparent!">
                        {COLS.map((col) => (
                            <TableHeaderCell key={col.label} {...col} />
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? Array.from({ length: 10 }).map((_, i) => (
                              <RowSkeleton key={i} />
                          ))
                        : epochs.map((epoch) => (
                              <EpochDataRow
                                  key={epoch.epoch}
                                  epoch={epoch}
                                  now={now}
                              />
                          ))}
                </TableBody>
            </Table>

            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                text="Prev"
                                onClick={() => goToPage(pageIndex - 1)}
                                aria-disabled={pageIndex === 0}
                            />
                        </PaginationItem>
                        <PaginationItem>
                            <PageInput
                                page={pageIndex + 1}
                                totalPages={totalPages}
                                onChangePage={(p) => goToPage(p - 1)}
                            />
                        </PaginationItem>
                        <PaginationItem>
                            <PaginationNext
                                text="Next"
                                onClick={() => goToPage(pageIndex + 1)}
                                aria-disabled={!hasNextPage}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </Page>
    );
}

function PageInput({
    page,
    totalPages,
    onChangePage,
}: {
    page: number;
    totalPages: number;
    onChangePage: (p: number) => void;
}) {
    const apply = (raw: string) => {
        const p = parseInt(raw);
        if (isNaN(p)) return;
        onChangePage(Math.min(Math.max(p, 1), totalPages));
    };

    return (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Input
                key={page}
                defaultValue={page}
                className="h-7 w-12 px-1 text-center"
                onBlur={(e) => apply(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter")
                        apply((e.target as HTMLInputElement).value);
                }}
            />
            <span>/ {totalPages}</span>
        </span>
    );
}

function EpochDataRow({ epoch, now }: { epoch: EpochRow; now: number }) {
    const isOngoing = epoch.epochEndTimestamp == null;
    const endAgo = epoch.epochEndTimestamp
        ? formatDuration(now - Number(epoch.epochEndTimestamp))
        : null;

    const totalTransactions = isOngoing
        ? null
        : Number(epoch.totalTransactions).toLocaleString();

    const stakeRewards = formatNanoToIota(epoch.stakeRewardsNano, true, 0);

    const lastCheckpointId = epoch.lastCheckpointId
        ? Number(epoch.lastCheckpointId).toLocaleString()
        : null;

    const storageNetInflow = formatNanoToIota(epoch.storageNetInflowNano);
    return (
        <TableRow className="text-xs">
            <TableCell className="font-medium">{epoch.epoch}</TableCell>
            <FormattedCell
                align="right"
                value={totalTransactions}
                label="txns"
            />
            <FormattedCell
                align="right"
                value={stakeRewards?.value}
                label={stakeRewards?.label}
            />
            <FormattedCell align="right" value={lastCheckpointId} />
            <FormattedCell
                align="right"
                value={storageNetInflow.value}
                label={storageNetInflow.label}
            />
            <FormattedCell
                align="right"
                value={endAgo ?? "Ongoing"}
                label={endAgo ? "ago" : undefined}
            />
        </TableRow>
    );
}

function RowSkeleton() {
    return (
        <TableRow>
            <TableCell>
                <Skeleton className="h-3 w-10" />
            </TableCell>
            <TableCell>
                <Skeleton className="ml-auto h-3 w-20" />
            </TableCell>
            <TableCell>
                <Skeleton className="ml-auto h-3 w-20" />
            </TableCell>
            <TableCell>
                <Skeleton className="ml-auto h-3 w-24" />
            </TableCell>
            <TableCell>
                <Skeleton className="ml-auto h-3 w-20" />
            </TableCell>
            <TableCell>
                <Skeleton className="ml-auto h-3 w-24" />
            </TableCell>
        </TableRow>
    );
}
