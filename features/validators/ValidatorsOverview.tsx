"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { formatIota } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function ValidatorsOverview({ className }: { className?: string }) {
    const { validators, isLoading, networkStats } = useContext(ValidatorsContext);

    const committeeValidators = validators.filter((v) => v.isCommitteeMember);
    const committeeStake = committeeValidators.reduce(
        (s, v) => s + v.stats.stakeIOTA,
        0
    );

    const avgApy = (() => {
        const vals = validators
            .map((v) => v.stats.apyPercent)
            .filter((x): x is number => x !== null);
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    })();

    const stats: { label: string; value: string | null }[] = [
        {
            label: "Active Validators",
            value: validators.length > 0 ? String(validators.length) : null,
        },
        {
            label: "Committee Size",
            value: networkStats
                ? `${committeeValidators.length} / ${networkStats.maxValidatorCount}`
                : null,
        },
        {
            label: "Committee Stake",
            value: (() => {
                if (committeeStake <= 0) return null;
                const { value, label } = formatIota(committeeStake);
                return `${value} ${label}`.trim();
            })(),
        },
        {
            label: "Avg APY",
            value: avgApy != null ? `${avgApy.toFixed(2)}%` : null,
        },
    ];

    return (
        <Card
            size="sm"
            className={cn("bg-[#6067F9]/80! backdrop-blur-xs", className)}
        >
            <CardContent>
                <div className="flex gap-4">
                    {stats.map(({ label, value }) => (
                        <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                                {label}
                            </span>
                            {isLoading && value === null ? (
                                <span className="mt-0.5 inline-block h-4 w-20 animate-pulse rounded bg-muted" />
                            ) : (
                                <span className="font-medium">
                                    {value ?? "—"}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
