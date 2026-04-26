"use client";

import { Stat } from "@/components/Stat";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function GasPriceCard({ className }: { className?: string }) {
    const { networkStats } = useContext(ValidatorsContext);

    const price = Number(networkStats?.referenceGasPrice) || "-";

    return (
        <Card className={cn(className)}>
            <CardContent>
                <CardTitle className="text-lg font-semibold">
                    Gas Price
                </CardTitle>
                <div className="flex items-baseline gap-1">
                    <Stat value={price} sub="IOTA nano" />
                </div>
            </CardContent>
        </Card>
    );
}
