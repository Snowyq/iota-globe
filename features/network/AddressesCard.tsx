"use client";

import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkContext } from "@/features/network/NetworkContext";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function AddressesCard({ className }: { className?: string }) {
    const { addressMetrics } = useContext(NetworkContext);

    const total = addressMetrics ? formatNumber(Number(addressMetrics.cumulativeAddresses)) : null;
    const totalActive = addressMetrics ? formatNumber(Number(addressMetrics.cumulativeActiveAddresses)) : null;
    const dailyActive = addressMetrics ? Number(addressMetrics.dailyActiveAddresses).toLocaleString() : null;

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Addresses</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
                <Stat value={total} label="Total" />
                <Stat value={totalActive} label="Total Active" />
                <Stat value={dailyActive} label="Daily Active" size="sm" />
            </CardContent>
        </Card>
    );
}
