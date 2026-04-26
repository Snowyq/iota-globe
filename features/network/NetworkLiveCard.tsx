"use client";

import { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { InnerLink } from "@/components/InnerLink";
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

type StoredTx = TransactionStreamItem & { arrivedAt: number };
type StoredCp = CheckpointStreamItem & { arrivedAt: number };

function Row({
    fresh,
    children,
}: {
    fresh: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                fresh ? "bg-primary/10" : "hover:bg-muted/40"
            )}
        >
            {children}
        </div>
    );
}

function Time({ arrivedAt, now }: { arrivedAt: number; now: number }) {
    return (
        <span className="shrink-0 text-muted-foreground tabular-nums">
            {timeAgo(arrivedAt, now)}
        </span>
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
    const [txs, setTxs] = useState<StoredTx[]>([]);
    const now = useNowTime();

    useOnNetworkChange(() => setTxs([]));

    useLiveStream<TransactionStreamItem>("/api/transactions/stream", (item) => {
        setTxs((prev) => {
            if (prev.some((t) => t.digest === item.digest)) return prev;
            return [{ ...item, arrivedAt: Date.now() }, ...prev].slice(0, MAX);
        });
    });

    if (txs.length === 0) return <ListSkeleton />;

    return (
        <div className="flex flex-col gap-px">
            {txs.map((tx, i) => (
                <Row key={tx.digest} fresh={i === 0}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-foreground">
                            {shortString(tx.digest, 8, 6)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {tx.isSystem
                                ? "IOTA System"
                                : shortString(tx.sender, 8, 4)}
                        </span>
                    </div>
                    <Time arrivedAt={tx.arrivedAt} now={now} />
                </Row>
            ))}
        </div>
    );
}

function CheckpointsList() {
    const [checkpoints, setCheckpoints] = useState<StoredCp[]>([]);
    const now = useNowTime();

    useOnNetworkChange(() => setCheckpoints([]));

    useLiveStream<CheckpointStreamItem>("/api/checkpoints/stream", (item) => {
        setCheckpoints((prev) => {
            if (prev.some((c) => c.sequenceNumber === item.sequenceNumber))
                return prev;
            return [{ ...item, arrivedAt: Date.now() }, ...prev].slice(0, MAX);
        });
    });

    if (checkpoints.length === 0) return <ListSkeleton />;

    return (
        <div className="flex flex-col gap-px">
            {checkpoints.map((cp, i) => (
                <Row key={cp.sequenceNumber} fresh={i === 0}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-foreground">
                            #{Number(cp.sequenceNumber).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {cp.txCount.toLocaleString()} tx
                        </span>
                    </div>
                    <Time arrivedAt={cp.arrivedAt} now={now} />
                </Row>
            ))}
        </div>
    );
}

export function NetworkLiveCard({ className }: { className?: string }) {
    const [tab, setTab] = useState("transactions");

    return (
        <Card
            className={cn("flex max-h-96 flex-col overflow-hidden", className)}
        >
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
                        <InnerLink href={"/transactions"} label="View all" />
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
