"use client";

import { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { InnerLink } from "@/components/InnerLink";
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
                "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                fresh ? "bg-primary/10" : "hover:bg-muted/40"
            )}
        >
            {children}
        </div>
    );
}

function Time({
    arrivedAt,
    className,
    now,
}: {
    arrivedAt: number;
    className?: string;
    now: number;
}) {
    return (
        <span
            className={cn(
                "w-14 shrink-0 text-muted-foreground tabular-nums",
                className
            )}
        >
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
                    </div>
                    <div className="mr-5 flex w-full min-w-0 flex-col items-end gap-0.5">
                        <Stat size="xs" value={cp.txCount} sub="txns" />
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
