"use client";

import { ActivitySkeleton } from "@/components/Loading";
import type { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import type { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { ArrowLeftRight, ArrowUp, Layers3 } from "lucide-react";
import { useRef, useState } from "react";
import {
    EmptyState,
    Panel,
    PanelHeader,
    StreamBadge,
    TextLink,
} from "@/features/dashboard/DashboardPrimitives";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { shortString, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBufferedActivity } from "./useBufferedActivity";

const transactionKey = (item: TransactionStreamItem) => item.digest;
const checkpointKey = (item: CheckpointStreamItem) => item.sequenceNumber;

export function NetworkLiveCard({ className }: { className?: string }) {
    const [tab, setTab] = useState<"transactions" | "checkpoints">(
        "transactions"
    );
    const transactions = useBufferedActivity(transactionKey);
    const checkpointFeed = useBufferedActivity(checkpointKey);
    const txs = transactions.items;
    const checkpoints = checkpointFeed.items;
    const listRef = useRef<HTMLDivElement>(null);
    const feed = tab === "transactions" ? transactions : checkpointFeed;
    const now = useNowTime();
    useOnNetworkChange(() => {
        transactions.reset();
        checkpointFeed.reset();
        if (listRef.current) listRef.current.scrollTop = 0;
    });
    const txStatus = useLiveStream<TransactionStreamItem>(
        tab === "transactions" ? "/api/transactions/stream" : null,
        transactions.push
    );
    const cpStatus = useLiveStream<CheckpointStreamItem>(
        tab === "checkpoints" ? "/api/checkpoints/stream" : null,
        checkpointFeed.push
    );
    const status = tab === "transactions" ? txStatus : cpStatus;
    const empty = tab === "transactions" ? !txs.length : !checkpoints.length;
    const latest = () => {
        feed.resume();
        if (listRef.current) listRef.current.scrollTop = 0;
    };
    const changeTab = (next: typeof tab) => {
        transactions.resume();
        checkpointFeed.resume();
        if (listRef.current) listRef.current.scrollTop = 0;
        setTab(next);
    };
    return (
        <Panel className={cn("live-panel", className)}>
            <PanelHeader
                title="Live activity"
                action={<StreamBadge status={status} />}
            />
            <div className="live-tabs" aria-label="Activity type">
                <button
                    aria-pressed={tab === "transactions"}
                    onClick={() => changeTab("transactions")}
                >
                    Transactions
                </button>
                <button
                    aria-pressed={tab === "checkpoints"}
                    onClick={() => changeTab("checkpoints")}
                >
                    Checkpoints
                </button>
                <span
                    className={`live-position ${feed.paused ? "is-held" : ""}`}
                >
                    <i aria-hidden="true" />
                    {feed.paused ? "Reading history" : "At latest"}
                </span>
            </div>
            <div className={`live-feed ${feed.paused ? "is-held" : ""}`}>
                {feed.paused && (
                    <button className="live-jump" onClick={latest}>
                        <ArrowUp size={13} />
                        {feed.unread
                            ? `${feed.unread} new ${feed.unread === 1 ? "event" : "events"}`
                            : "Back to latest"}
                    </button>
                )}
                <div
                    className="live-list"
                    ref={listRef}
                    tabIndex={0}
                    role="region"
                    aria-label="Live activity events"
                    onScroll={(event) => {
                        if (event.currentTarget.scrollTop > 8) feed.hold();
                        else feed.resume();
                    }}
                >
                    {empty && status === "connecting" ? (
                        <ActivitySkeleton />
                    ) : empty ? (
                        <EmptyState
                            error={status === "reconnecting"}
                            title={
                                status === "reconnecting"
                                    ? "Reconnecting to the stream"
                                    : "Listening for activity"
                            }
                            description="New network events appear here automatically."
                        />
                    ) : tab === "transactions" ? (
                        txs.map((tx) => {
                            const ago = timeAgo(tx.timestampMs, now);
                            return (
                                <div className="live-row" key={tx.digest}>
                                    <span className="live-row-icon">
                                        <ArrowLeftRight size={12} />
                                    </span>
                                    <div>
                                        <span title={tx.digest}>
                                            {shortString(tx.digest, 5, 4)}
                                        </span>
                                        <small>
                                            {tx.isSystem
                                                ? "System transaction"
                                                : `${tx.txnsCount ?? "—"} operations`}
                                        </small>
                                    </div>
                                    <span className="live-row-gas">
                                        {tx.gasIOTA.toFixed(4)}
                                        <small> IOTA</small>
                                    </span>
                                    <time>
                                        {ago.value}
                                        {ago.label}
                                    </time>
                                </div>
                            );
                        })
                    ) : (
                        checkpoints.map((cp) => {
                            const ago = timeAgo(cp.timestampMs, now);
                            return (
                                <div
                                    className="live-row"
                                    key={cp.sequenceNumber}
                                >
                                    <span className="live-row-icon">
                                        <Layers3 size={12} />
                                    </span>
                                    <div>
                                        <span>
                                            #
                                            {Number(
                                                cp.sequenceNumber
                                            ).toLocaleString("en-US")}
                                        </span>
                                        <small>{cp.txCount} transactions</small>
                                    </div>
                                    <time>
                                        {ago.value}
                                        {ago.label}
                                    </time>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <div className="panel-bottom-note">
                <span>
                    Latest{" "}
                    {tab === "transactions" ? txs.length : checkpoints.length}{" "}
                    events
                </span>
                <TextLink href="/transactions">View transactions</TextLink>
            </div>
        </Panel>
    );
}
