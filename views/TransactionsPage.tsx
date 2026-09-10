"use client";

import type { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { CopyButton } from "@/components/CopyButton";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { TableHeaderCell } from "@/components/TableHeaderCell";
import { SearchField } from "@/components/SearchField";
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
    Metric,
    StreamBadge,
    compact,
} from "@/features/dashboard/DashboardPrimitives";
import { ThroughputChart } from "@/features/dashboard/ThroughputChart";
import { NetworkContext } from "@/features/network/NetworkContext";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { shortString, timeAgo } from "@/lib/format";
import {
    Activity,
    ArrowLeftRight,
    Coins,
    Layers3,
    Pause,
    Play,
} from "lucide-react";
import { useContext, useState } from "react";

const MAX_ITEMS = 100;
export default function TransactionsPage() {
    const {
        totalTransactions,
        networkMetrics,
        samples,
        isLoading: networkLoading,
    } = useContext(NetworkContext);
    const [txs, setTxs] = useState<TransactionStreamItem[]>([]);
    const [snapshot, setSnapshot] = useState<TransactionStreamItem[] | null>(
        null
    );
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const now = useNowTime();
    useOnNetworkChange(() => {
        setTxs([]);
        setSnapshot(null);
    });
    const status = useLiveStream<TransactionStreamItem>(
        "/api/transactions/stream",
        (item) =>
            setTxs((prev) =>
                prev.some((t) => t.digest === item.digest)
                    ? prev
                    : [item, ...prev].slice(0, MAX_ITEMS)
            )
    );
    const visible = snapshot ?? txs;
    const filtered = visible.filter(
        (tx) =>
            (filter === "all" ||
                (filter === "system" ? tx.isSystem : !tx.isSystem)) &&
            `${tx.digest} ${tx.sender}`
                .toLowerCase()
                .includes(query.toLowerCase().trim())
    );
    const averageGas = visible.length
        ? visible.reduce((sum, tx) => sum + tx.gasIOTA, 0) / visible.length
        : null;
    return (
        <Page>
            <PageHeader
                title="Transactions"
                description="Follow the latest activity as it moves through the network."
                action={<StreamBadge status={status} />}
            />
            <div className="page-summary">
                <Metric
                    label="Total transactions"
                    isLoading={networkLoading && !networkMetrics}
                    value={compact(totalTransactions)}
                    detail="All-time network transactions"
                    icon={ArrowLeftRight}
                />
                <Metric
                    label="Current throughput"
                    isLoading={!samples.length && status === "connecting"}
                    value={samples.at(-1)?.tps.toFixed(2)}
                    unit="tx/s"
                    detail="Latest live sample"
                    icon={Activity}
                    tone="purple"
                />
                <Metric
                    label="Current checkpoint"
                    isLoading={networkLoading && !networkMetrics}
                    value={
                        networkMetrics
                            ? compact(networkMetrics.currentCheckpoint, 3)
                            : null
                    }
                    detail="Latest network snapshot"
                    icon={Layers3}
                    tone="teal"
                />
                <Metric
                    label="Average gas, received sample"
                    isLoading={
                        !visible.length && !snapshot && status === "connecting"
                    }
                    value={averageGas?.toFixed(4)}
                    unit="IOTA"
                    detail={`From ${visible.length} received transactions`}
                    icon={Coins}
                    tone="amber"
                />
            </div>
            <ThroughputChart />
            <section className="table-panel" aria-label="Recent transactions">
                <div className="table-toolbar">
                    <SearchField
                        label="Search by transaction digest or sender"
                        placeholder="Search digest or sender…"
                        value={query}
                        onChange={setQuery}
                    />
                    <div className="transaction-controls">
                        <div
                            className="filter-tabs"
                            aria-label="Filter transactions"
                        >
                            {["all", "user", "system"].map((value) => (
                                <button
                                    key={value}
                                    aria-pressed={filter === value}
                                    onClick={() => setFilter(value)}
                                >
                                    {value === "all"
                                        ? "All transactions"
                                        : value === "user"
                                          ? "User"
                                          : "System"}
                                </button>
                            ))}
                        </div>
                        <button
                            className="subtle-button"
                            aria-pressed={snapshot !== null}
                            onClick={() =>
                                setSnapshot(snapshot ? null : [...txs])
                            }
                        >
                            {snapshot ? (
                                <Play size={12} />
                            ) : (
                                <Pause size={12} />
                            )}
                            {snapshot ? "Resume" : "Pause feed"}
                        </button>
                    </div>
                </div>
                {visible.length === 0 ? (
                    <EmptyState
                        error={status === "reconnecting"}
                        title={
                            snapshot
                                ? "Feed paused"
                                : status === "reconnecting"
                                  ? "Reconnecting to the network"
                                  : "Waiting for transactions"
                        }
                        description={
                            snapshot
                                ? "Resume the feed to see newly received transactions."
                                : "Recent transactions will appear automatically when received."
                        }
                    />
                ) : (
                    <Table>
                        <TableCaption>
                            {snapshot ? "Feed paused. " : ""}Showing{" "}
                            {filtered.length} of the last {visible.length}{" "}
                            received transactions. The feed samples recent
                            checkpoints.
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell label="Transaction digest" />
                                <TableHeaderCell label="Sender" />
                                <TableHeaderCell label="Type" />
                                <TableHeaderCell
                                    label="Operations"
                                    align="right"
                                />
                                <TableHeaderCell
                                    label="Gas (IOTA)"
                                    align="right"
                                />
                                <TableHeaderCell label="Age" align="right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length ? (
                                filtered.map((tx) => {
                                    const t = timeAgo(tx.timestampMs, now);
                                    return (
                                        <TableRow key={tx.digest}>
                                            <TableCell>
                                                <span
                                                    className="inline-flex items-center gap-2 font-mono text-[#bdc5eb]"
                                                    title={tx.digest}
                                                >
                                                    {shortString(
                                                        tx.digest,
                                                        9,
                                                        6
                                                    )}
                                                    <CopyButton
                                                        value={tx.digest}
                                                        label="Copy transaction digest"
                                                    />
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {tx.isSystem ? (
                                                    <span className="text-muted-foreground">
                                                        IOTA System
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-2 font-mono"
                                                        title={tx.sender}
                                                    >
                                                        {shortString(
                                                            tx.sender,
                                                            6,
                                                            4
                                                        )}
                                                        <CopyButton
                                                            value={tx.sender}
                                                            label="Copy sender address"
                                                        />
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`transaction-type ${tx.isSystem ? "system" : ""}`}
                                                >
                                                    {tx.isSystem
                                                        ? "System"
                                                        : "User"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {tx.txnsCount ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {tx.gasIOTA.toFixed(5)}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground tabular-nums">
                                                {t.value} {t.label}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        No transactions match your search.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </section>
        </Page>
    );
}
