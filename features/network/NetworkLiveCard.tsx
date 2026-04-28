"use client";

import { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { SiteLink } from "@/components/SiteLink";
import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { shortString, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MAX = 20;

function Row({ children }: { children: React.ReactNode }) {
    return (
        <div
            className={cn(
                "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs transition-colors"
            )}
        >
            {children}
        </div>
    );
}

function Time({
    timestampMs,
    now,
}: {
    timestampMs: string | null;
    now: number;
}) {
    const t = timeAgo(timestampMs, now);
    return (
        <Stat
            size={"xs"}
            className="w-14 shrink-0 text-right text-muted-foreground tabular-nums"
            value={t.value}
            sub={t.label}
        />
    );
}

function ListSkeleton() {
    return (
        <div className="flex flex-col gap-px">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between px-2 py-1.5"
                >
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-3 w-10" />
                </div>
            ))}
        </div>
    );
}

function TransactionsList() {
    const [txs, setTxs] = useState<TransactionStreamItem[]>([]);
    const now = useNowTime();

    useOnNetworkChange(() => setTxs([]));

    useLiveStream<TransactionStreamItem>("/api/transactions/stream", (item) => {
        setTxs((prev) => {
            if (prev.some((t) => t.digest === item.digest)) return prev;
            return [item, ...prev].slice(0, MAX);
        });
    });

    if (txs.length === 0) return <ListSkeleton />;

    return (
        <div className="flex flex-col gap-px">
            {txs.map((tx, i) => (
                <Row key={tx.digest}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-foreground">
                            {shortString(tx.digest, 4, 6)}
                        </span>

                        <span className="text-[10px] text-nowrap text-muted-foreground">
                            {tx.isSystem
                                ? "IOTA System"
                                : shortString(tx.sender, 4, 6)}
                        </span>
                    </div>
                    <div className="flex w-full min-w-0 flex-col items-end gap-0.5 @[25rem]:mr-2">
                        <Stat
                            size="xs"
                            value={
                                tx.gasIOTA > 0 ? tx.gasIOTA.toFixed(4) : null
                            }
                            sub="IOTA"
                        />
                        <Stat size="xs" value={tx.txnsCount} sub="txns" />
                    </div>
                    <Time timestampMs={tx.timestampMs} now={now} />
                </Row>
            ))}
        </div>
    );
}

function CheckpointsList() {
    const [checkpoints, setCheckpoints] = useState<CheckpointStreamItem[]>([]);
    const now = useNowTime();

    useOnNetworkChange(() => setCheckpoints([]));

    useLiveStream<CheckpointStreamItem>("/api/checkpoints/stream", (item) => {
        setCheckpoints((prev) => {
            if (prev.some((c) => c.sequenceNumber === item.sequenceNumber))
                return prev;
            return [item, ...prev].slice(0, MAX);
        });
    });

    if (checkpoints.length === 0) return <ListSkeleton />;

    return (
        <div className="flex flex-col gap-px">
            {checkpoints.map((cp, i) => (
                <Row key={cp.sequenceNumber}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-foreground">
                            #{Number(cp.sequenceNumber).toLocaleString()}
                        </span>
                    </div>
                    <div className="mr-5 flex w-full min-w-0 flex-col items-end gap-0.5">
                        <Stat size="xs" value={cp.txCount} sub="txns" />
                    </div>
                    <Time timestampMs={cp.timestampMs} now={now} />
                </Row>
            ))}
        </div>
    );
}

export function NetworkLiveCard({ className }: { className?: string }) {
    const [tab, setTab] = useState("transactions");

    return (
        <Card className={cn("flex flex-col overflow-hidden", className)}>
            <CardHeader className="shrink-0 pb-0">
                <CardTitle>Live Activity</CardTitle>
                <div className="flex items-center justify-between gap-2">
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList>
                            <TabsTrigger
                                className="text-xs"
                                value="transactions"
                            >
                                Transactions
                            </TabsTrigger>
                            <TabsTrigger
                                className="text-xs"
                                value="checkpoints"
                            >
                                Checkpoints
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {tab === "transactions" ? (
                        <SiteLink href={"/transactions"} label="View all" />
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                    {tab === "transactions" ? (
                        <TransactionsList />
                    ) : (
                        <CheckpointsList />
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
