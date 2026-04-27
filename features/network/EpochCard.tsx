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
import { OptionsContext } from "../options/OptionsContext";

export function EpochCard({ className }: { className?: string }) {
    const { networkStats } = useContext(ValidatorsContext);
    const { isFullscreen } = useContext(OptionsContext);
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
        <Card
            size="sm"
            className={cn(
                "flex w-full flex-row gap-1! border-2 border-primary bg-primary/50 shadow-primary backdrop-blur-md sm:gap-0!",
                className
            )}
        >
            <CardContent
                className={cn(
                    "flex w-full flex-col justify-between gap-2 sm:flex-row sm:gap-6",
                    isFullscreen && "flex-col!"
                )}
            >
                <div className="flex flex-col gap-1 max-xs:justify-between">
                    <CardTitle className="w-fit text-nowrap">
                        {networkStats
                            ? `Epoch #${networkStats.epoch}`
                            : "Epoch"}
                    </CardTitle>
                    <CardDescription className="flex flex-col text-xs text-nowrap text-foreground">
                        <span>Started: {startedAt}</span>
                    </CardDescription>
                </div>
                <div className="flex min-w-64 flex-col justify-center gap-1.5 rounded-lg bg-primary/40 px-2 py-2">
                    <div className="flex items-baseline justify-between text-xs">
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
                                  ? formatDuration(remainingMs)
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
