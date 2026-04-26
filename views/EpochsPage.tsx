"use client";

import { EpochRow, EpochsApiResponse } from "@/app/api/epochs/route";
import { FormattedCell } from "@/components/FormattedCell";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
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
import { formatDuration, formatNanoToIota } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";

const COLS = [
    { label: "Epoch" },
    { label: "Transaction Blocks", right: true },
    { label: "Stake Rewards", right: true },
    { label: "Checkpoint Set", right: true },
    { label: "Storage Net Inflow", right: true },
    { label: "Epoch End", right: true },
];

function EpochDataRow({ epoch, now }: { epoch: EpochRow; now: number }) {
    const isOngoing = epoch.epochEndTimestamp == null;
    const endAgo = epoch.epochEndTimestamp
        ? formatDuration(now - Number(epoch.epochEndTimestamp))
        : null;

    return (
        <TableRow className="text-xs">
            <TableCell className="font-medium">{epoch.epoch}</TableCell>
            <FormattedCell
                align="right"
                value={
                    isOngoing
                        ? null
                        : Number(epoch.totalTransactions).toLocaleString()
                }
                label="txns"
            />
            <FormattedCell
                align="right"
                value={
                    isOngoing
                        ? null
                        : formatNanoToIota(epoch.stakeRewardsNano).value
                }
                label={
                    isOngoing
                        ? "IOTA"
                        : formatNanoToIota(epoch.stakeRewardsNano).label
                }
            />
            <FormattedCell
                align="right"
                value={
                    epoch.lastCheckpointId
                        ? Number(epoch.lastCheckpointId).toLocaleString()
                        : null
                }
            />
            <FormattedCell
                align="right"
                value={
                    isOngoing
                        ? null
                        : formatNanoToIota(epoch.storageNetInflowNano).value
                }
                label={
                    isOngoing
                        ? "IOTA"
                        : formatNanoToIota(epoch.storageNetInflowNano).label
                }
            />
            <FormattedCell
                align="right"
                value={endAgo ?? "Ongoing"}
                label={endAgo ? "ago" : undefined}
            />
        </TableRow>
    );
}

export default function EpochsPage() {
    const { network } = useContext(OptionsContext);
    const [epochs, setEpochs] = useState<EpochRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    // cursor stack: index 0 = first page (no cursor), each entry is the cursor used to fetch that page
    const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
    const [pageIndex, setPageIndex] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasNextPage, setHasNextPage] = useState(false);

    useEffect(() => {
        setCursorStack([null]);
        setPageIndex(0);
        setNextCursor(null);
        setHasNextPage(false);
    }, [network]);

    useEffect(() => {
        const cursor = cursorStack[pageIndex];
        const url = `/api/epochs?dataset=${network}${cursor ? `&cursor=${cursor}` : ""}`;

        setIsLoading(true);
        fetch(url)
            .then((r) => r.json() as Promise<EpochsApiResponse>)
            .then(({ epochs, nextCursor, hasNextPage }) => {
                setEpochs(epochs);
                setNextCursor(nextCursor);
                setHasNextPage(hasNextPage);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [network, pageIndex, cursorStack]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(id);
    }, []);

    const goNext = () => {
        if (!hasNextPage || !nextCursor) return;
        setCursorStack((prev) => {
            const stack = prev.slice(0, pageIndex + 1);
            return [...stack, nextCursor];
        });
        setPageIndex((p) => p + 1);
    };

    const goPrev = () => {
        if (pageIndex === 0) return;
        setPageIndex((p) => p - 1);
    };

    const currentPage = pageIndex + 1;

    return (
        <Page>
            <PageHeader title="Epochs" description="Recent epoch statistics" />

            <Table className="w-full">
                <TableCaption>IOTA epoch history.</TableCaption>
                <TableHeader>
                    <TableRow className="hover:bg-transparent!">
                        {COLS.map(({ label, right }) => (
                            <TableCell
                                key={label}
                                className={cn(
                                    "text-xs text-muted-foreground",
                                    right && "text-right"
                                )}
                            >
                                {label}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? Array.from({ length: 10 }).map((_, i) => (
                              <TableRow key={i}>
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

            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={goPrev}
                            aria-disabled={pageIndex === 0}
                        />
                    </PaginationItem>
                    <PaginationItem>
                        <span className="px-3 text-sm text-muted-foreground">
                            Page {currentPage}
                        </span>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext
                            onClick={goNext}
                            aria-disabled={!hasNextPage}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </Page>
    );
}
