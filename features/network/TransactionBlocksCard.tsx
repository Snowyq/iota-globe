"use client";

import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkContext } from "@/features/network/NetworkContext";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function TransactionBlocksCard({ className }: { className?: string }) {
    const { totalTransactions, lastEpochTransactions } = useContext(NetworkContext);

    const total = totalTransactions ? formatNumber(Number(totalTransactions)) : null;
    const lastEpoch = lastEpochTransactions ? formatNumber(Number(lastEpochTransactions)) : null;

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Transaction Blocks</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <Stat value={total} label="Total" />
                <Stat value={lastEpoch} label="Last Epoch" />
            </CardContent>
        </Card>
    );
}
