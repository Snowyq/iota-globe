"use client";

import { TpsStreamItem } from "@/app/api/tps/stream/route";
import { Stat } from "@/components/Stat";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { cn } from "@/lib/utils";
import { useContext, useState } from "react";
import { NetworkContext } from "./NetworkContext";

export function TpsCard({
    className,
    max = 30,
}: {
    className?: string;
    max?: number;
}) {
    const { networkMetrics } = useContext(NetworkContext);
    const [samples, setSamples] = useState<number[]>([]);
    const [currentTps, setCurrentTps] = useState<number | null>(null);

    useOnNetworkChange(() => {
        setSamples([]);
        setCurrentTps(null);
    });

    useLiveStream<TpsStreamItem>("/api/tps/stream", (item) => {
        setCurrentTps(item.currentTps);
        setSamples((prev) => {
            const next = [...prev, item.currentTps];
            return next.length > max ? next.slice(-max) : next;
        });
    });

    const maxVal = Math.max(...samples, 1);
    const fillerCount = max - samples.length;
    // const secAgo = Math.round(fillerCount > 0 ? samples.length : max);
    // const peak30dTps = networkMetrics
    //     ? networkMetrics.tps30Days.toFixed(2)
    //     : null;

    return (
        <Card size="sm" className={cn("flex justify-center", className)}>
            <CardContent className="relative flex items-center gap-2">
                <div className="absolute inset-y-0 left-0 flex flex-col justify-center bg-linear-to-r from-card to-card/0 pr-4 pl-6">
                    <CardTitle>TPS</CardTitle>
                    <Stat
                        value={Number(currentTps).toFixed(0)}
                        sub="tx/s"
                        className="min-w-30"
                    />
                </div>
                <div className="flex w-full flex-col justify-center gap-1 py-1">
                    <div className="flex h-20 items-end gap-px">
                        {Array.from({ length: fillerCount }).map((_, i) => (
                            // required to fill empty space
                            <div key={`f-${i}`} className="flex-1" />
                        ))}
                        {samples.map((s, i) => {
                            const isLatest = i === samples.length - 1;
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-1 rounded",
                                        isLatest
                                            ? "bg-primary"
                                            : "bg-primary/60"
                                    )}
                                    style={{
                                        height: `${Math.max((s / maxVal) * 100, 2)}%`,
                                    }}
                                />
                            );
                        })}
                    </div>
                    {/* <div className="flex justify-between text-xs text-muted-foreground">
                        <span>~{secAgo}s ago</span>
                        <span>now</span>
                    </div> */}
                </div>
            </CardContent>
        </Card>
    );
}
