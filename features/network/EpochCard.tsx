"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useNowTime } from "@/hooks/useNowTime";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useContext, useState } from "react";

export function EpochCard({ className }: { className?: string }) {
    const { networkStats } = useContext(ValidatorsContext);
    const now = useNowTime();
    const [showEnd, setShowEnd] = useState(false);

    const epoch = networkStats
        ? {
              startMs: Number(networkStats.epochStartTimestampMs),
              durationMs: Number(networkStats.epochDurationMs),
          }
        : null;

    const endMs = epoch ? epoch.startMs + epoch.durationMs : null;
    const remainingMs = endMs !== null ? Math.max(0, endMs - now) : null;
    const progress = epoch
        ? Math.min(1, (now - epoch.startMs) / epoch.durationMs)
        : null;

    const startedAt = formatTimestamp(
        networkStats?.epochStartTimestampMs,
        "long"
    );

    return (
        <Card size="sm" className={cn("flex-row", className)}>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-row gap-6">
                    <CardTitle className="w-fit text-nowrap">
                        {networkStats
                            ? `Epoch #${networkStats.epoch}`
                            : "Epoch"}
                    </CardTitle>
                    <CardDescription className="flex flex-col text-xs text-nowrap text-primary-foreground">
                        <span>Started: </span>
                        <span>{startedAt}</span>
                    </CardDescription>
                </div>
                <div className="flex min-w-48 flex-col gap-1.5 rounded-lg bg-primary/40 px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <Button
                            onClick={() => setShowEnd((v) => !v)}
                            variant={"outline"}
                            size={"xs"}
                        >
                            <Clock />
                            <span className="ml-0.5">
                                {showEnd ? "Ends" : "Remaining"}
                            </span>
                        </Button>
                        <span className="font-medium text-primary-foreground tabular-nums">
                            {showEnd
                                ? formatTimestamp(endMs, "long")
                                : remainingMs !== null
                                  ? formatDuration(remainingMs, "short")
                                  : "—"}
                        </span>
                    </div>
                    <ProgressBar progress={progress ?? 0} />
                </div>
            </CardContent>
        </Card>
    );
}

function ProgressBar({ progress }: { progress: number }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/20">
            <div
                className="h-full rounded-full bg-primary-foreground/80 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress * 100}%` }}
            />
        </div>
    );
}
