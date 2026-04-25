"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useContext } from "react";
import { ValidatorsContext } from "./ValidatorsContext";

export default function ValidatorsGeoStats({
    className,
}: {
    className?: string;
}) {
    const { validators } = useContext(ValidatorsContext);
    const geoValidators = validators.map((v) => v.geo);
    const cities = new Set(geoValidators.map((g) => g?.city));
    const countries = new Set(geoValidators.map((g) => g?.country));
    console.log(cities.size);
    console.log(countries.size);

    return (
        <Card size="sm" className={cn("", className)}>
            <CardHeader className="flex h-full items-center justify-around gap-4">
                <Value label="Validators" value={geoValidators.length} />
                <Value label="cities" value={cities.size} />
                <Value label="countries" value={countries.size} />
            </CardHeader>
        </Card>
    );
}

function Value({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex h-full flex-col items-center justify-center">
            <span className="text-base font-medium">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}
