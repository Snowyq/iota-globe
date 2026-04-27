"use client";

import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkContext } from "@/features/network/NetworkContext";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function AddressesCard({ className }: { className?: string }) {
    const { addressMetrics } = useContext(NetworkContext);

    const {
        cumulativeAddresses,
        cumulativeActiveAddresses,
        dailyActiveAddresses,
    } = addressMetrics || {};

    const total = formatNumber(Number(cumulativeAddresses));
    const totalActive = formatNumber(Number(cumulativeActiveAddresses));
    const dailyActive = formatNumber(Number(dailyActiveAddresses));

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Addresses</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 items-end gap-4">
                <Stat value={total.value} sub={total.label} label="Total" />
                <Stat
                    value={totalActive.value}
                    sub={totalActive.label}
                    label="Total Active"
                    size="sm"
                />
                <Stat
                    value={dailyActive.value}
                    sub={dailyActive.label}
                    label="Daily Active"
                    size="sm"
                />
            </CardContent>
        </Card>
    );
}
