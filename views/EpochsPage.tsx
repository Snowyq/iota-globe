"use client";

import type { EpochRow, EpochsApiResponse } from "@/app/api/epochs/route";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { TableHeaderCell } from "@/components/TableHeaderCell";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    EmptyState,
    ErrorBanner,
    Metric,
    compact,
    nano,
} from "@/features/dashboard/DashboardPrimitives";
import { EpochHistoryChart } from "@/features/dashboard/EpochHistoryChart";
import { EpochProgress } from "@/features/dashboard/EpochProgress";
import { NetworkContext } from "@/features/network/NetworkContext";
import { OptionsContext } from "@/features/options/OptionsContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { formatDuration, formatUtc } from "@/lib/format";
import { withTimeout } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useContext, useEffect, useState } from "react";

const iotaAmount = (value: string | null) =>
    value == null
        ? "—"
        : (Number(value) / 1e9).toLocaleString("en-US", {
              maximumFractionDigits: 2,
          });

export default function EpochsPage() {
    const { network } = useContext(OptionsContext);
    const { networkStats, isLoading: validatorsLoading } =
        useContext(ValidatorsContext);
    const {
        lastEpochTransactions,
        lastEpochRewards,
        networkMetrics,
        isLoading: networkLoading,
    } = useContext(NetworkContext);
    const [epochs, setEpochs] = useState<EpochRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        network,
        pageIndex: 0,
        cursors: [null] as (string | null)[],
    });
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasNext, setHasNext] = useState(false);
    const [retry, setRetry] = useState(0);
    // Cursors are per network; never reuse one after switching.
    const pageIndex = pagination.network === network ? pagination.pageIndex : 0;
    const cursors =
        pagination.network === network ? pagination.cursors : [null];
    const cursor = cursors[pageIndex] ?? null;
    useEffect(() => {
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        setError(null);
        setEpochs([]);
        setHasNext(false);
        fetch(
            `/api/epochs?dataset=${network}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
            { signal: withTimeout(controller.signal, 20_000) }
        )
            .then(async (response) => {
                if (!response.ok) throw new Error("Failed to load epochs");
                return response.json() as Promise<EpochsApiResponse>;
            })
            .then((data) => {
                if (controller.signal.aborted) return;
                if (!Array.isArray(data.epochs))
                    throw new Error("Invalid epoch response");
                setEpochs(data.epochs);
                setHasNext(data.hasNextPage);
                setNextCursor(data.nextCursor);
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setError("Epoch history could not be loaded. Try again.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [network, cursor, retry]);
    const next = () => {
        if (!nextCursor || !hasNext) return;
        setPagination({
            network,
            cursors: [...cursors.slice(0, pageIndex + 1), nextCursor],
            pageIndex: pageIndex + 1,
        });
    };
    return (
        <Page>
            <PageHeader
                title="Epoch history"
                description="Completed epochs with their transactions, staking rewards and storage flows."
            />
            <div className="page-summary">
                <Metric
                    label="Current epoch"
                    isLoading={validatorsLoading && !networkStats}
                    value={networkStats ? `#${networkStats.epoch}` : null}
                    detail="Current network cycle"
                />
                <Metric
                    label="Last epoch transactions"
                    isLoading={networkLoading && !networkMetrics}
                    value={compact(lastEpochTransactions)}
                    detail="Most recently completed epoch"
                />
                <Metric
                    label="Last epoch rewards"
                    isLoading={networkLoading && !networkMetrics}
                    value={compact(
                        nano(lastEpochRewards?.totalStakeRewardsDistributed)
                    )}
                    unit="IOTA"
                    detail="Distributed staking rewards"
                />
                <Metric
                    label="Epoch duration"
                    isLoading={validatorsLoading && !networkStats}
                    value={
                        networkStats
                            ? formatDuration(
                                  Number(networkStats.epochDurationMs)
                              )
                            : null
                    }
                    detail={
                        networkMetrics
                            ? `Checkpoint #${Number(networkMetrics.currentCheckpoint).toLocaleString("en-US")}`
                            : "Awaiting system state"
                    }
                />
            </div>
            <div className="epoch-page-progress">
                <EpochProgress />
            </div>
            {error && (
                <ErrorBanner
                    role="alert"
                    onRetry={() => setRetry((r) => r + 1)}
                >
                    {error}
                </ErrorBanner>
            )}
            <EpochHistoryChart
                epochs={epochs}
                isLoading={isLoading}
                error={!!error}
            />
            <section className="table-panel" aria-label="Epoch history">
                <div className="table-toolbar">
                    <div>
                        <h2 className="text-[13px] font-medium">
                            Epoch ledger
                        </h2>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                            Transactions, rewards and storage economics
                        </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                        {isLoading ? "Loading…" : `${epochs.length} epochs`}
                    </span>
                </div>
                {!epochs.length ? (
                    <EmptyState
                        error={!!error}
                        title={
                            isLoading
                                ? "Loading epoch records"
                                : error
                                  ? "Epoch records unavailable"
                                  : "No epochs found"
                        }
                    />
                ) : (
                    <Table className="stack-table">
                        <TableCaption>
                            Amounts in IOTA. The current epoch is still
                            accumulating transactions and rewards.
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                {[
                                    { label: "Epoch" },
                                    {
                                        label: "Transactions",
                                        align: "right" as const,
                                    },
                                    {
                                        label: "Staking rewards (IOTA)",
                                        align: "right" as const,
                                    },
                                    {
                                        label: "Last checkpoint",
                                        align: "right" as const,
                                    },
                                    {
                                        label: "Storage net inflow (IOTA)",
                                        align: "right" as const,
                                    },
                                    { label: "Ended", align: "right" as const },
                                ].map((col) => (
                                    <TableHeaderCell key={col.label} {...col} />
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {epochs.map((epoch) => (
                                <TableRow key={epoch.epoch}>
                                    <TableCell>
                                        <span className="font-mono font-medium text-primary">
                                            #{epoch.epoch}
                                        </span>
                                        {epoch.epochEndTimestamp == null && (
                                            <span className="epoch-ongoing">
                                                Ongoing
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell
                                        data-label="Transactions"
                                        className="text-right tabular-nums"
                                    >
                                        {Number(
                                            epoch.totalTransactions
                                        ).toLocaleString("en-US")}
                                    </TableCell>
                                    <TableCell
                                        data-label="Rewards (IOTA)"
                                        className="text-right tabular-nums"
                                    >
                                        {iotaAmount(epoch.stakeRewardsNano)}
                                    </TableCell>
                                    <TableCell
                                        data-label="Last checkpoint"
                                        className="text-right tabular-nums"
                                    >
                                        {epoch.lastCheckpointId == null
                                            ? "—"
                                            : Number(
                                                  epoch.lastCheckpointId
                                              ).toLocaleString("en-US")}
                                    </TableCell>
                                    <TableCell
                                        data-label="Storage inflow"
                                        className="text-right tabular-nums"
                                    >
                                        {iotaAmount(epoch.storageNetInflowNano)}
                                    </TableCell>
                                    <TableCell
                                        data-label="Ended"
                                        className="text-right text-muted-foreground"
                                    >
                                        {epoch.epochEndTimestamp
                                            ? `${formatUtc(Number(epoch.epochEndTimestamp))} UTC`
                                            : "In progress"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </section>
            <div className="epoch-pagination">
                <button
                    className="subtle-button"
                    disabled={pageIndex === 0 || isLoading}
                    onClick={() =>
                        setPagination({
                            network,
                            cursors,
                            pageIndex: Math.max(0, pageIndex - 1),
                        })
                    }
                >
                    <ArrowLeft size={13} />
                    Newer epochs
                </button>
                <span>Page {pageIndex + 1}</span>
                <button
                    className="subtle-button"
                    disabled={!hasNext || isLoading || !!error}
                    onClick={next}
                >
                    Older epochs
                    <ArrowRight size={13} />
                </button>
            </div>
        </Page>
    );
}
