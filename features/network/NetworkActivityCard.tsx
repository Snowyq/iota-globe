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

    const { totalPackages, totalObjects } = networkMetrics || {};
    const { iotaTotalSupply } = networkStats || {};

    const totalPackagesFormat = formatNumber(Number(totalPackages) ?? null);
    const totalObjectsFormat = formatNumber(Number(totalObjects) ?? null);
    const totalSupplyFormat = formatNanoToIota(iotaTotalSupply ?? null);
    const circSupplyFormat = formatNanoToIota(circulatingSupply?.value ?? null);

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Network Activity</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <Stat
                    value={totalPackagesFormat.value}
                    sub={totalPackagesFormat.label}
                    label="Total Packages"
                />
                <Stat
                    value={totalObjectsFormat.value}
                    sub={totalObjectsFormat.label}
                    label="Objects"
                />
                <Stat
                    value={totalSupplyFormat.value}
                    sub={totalSupplyFormat.label}
                    label="Total Supply"
                />
                <Stat
                    value={circSupplyFormat.value}
                    sub={circSupplyFormat.label}
                    label="Circulating Supply"
                />
            </CardContent>
        </Card>
    );
}
