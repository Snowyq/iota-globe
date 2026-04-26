"use client";

import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkContext } from "@/features/network/NetworkContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { formatNanoToIota, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export default function NetworkActivityCard({
    className,
}: {
    className?: string;
}) {
    const { networkMetrics, circulatingSupply } = useContext(NetworkContext);
    const { networkStats } = useContext(ValidatorsContext);

    const totalPackages = networkMetrics
        ? formatNumber(Number(networkMetrics.totalPackages))
        : null;
    const totalObjects = networkMetrics
        ? formatNumber(Number(networkMetrics.totalObjects))
        : null;

    const totalSupply = formatNanoToIota(networkStats?.iotaTotalSupply ?? null);
    const circSupply = circulatingSupply
        ? formatNanoToIota(circulatingSupply.value)
        : null;

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Network Activity</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <Stat value={totalPackages} label="Total Packages" />
                <Stat value={totalObjects} label="Objects" />
                <Stat
                    value={totalSupply.value}
                    sub={totalSupply.label}
                    label="Total Supply"
                />
                <Stat
                    value={circSupply?.value}
                    sub={circSupply?.label}
                    label="Circulating Supply"
                />
            </CardContent>
        </Card>
    );
}
