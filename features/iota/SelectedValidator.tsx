"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ValidatorsContext } from "@/features/iota/ValidatorsContext";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function SelectedValidator({ className }: { className?: string }) {
    const { selectedValidator, deselectValidator } =
        useContext(ValidatorsContext);

    // const { moveGlobeTo, resetGlobe } = useContext(GlobeContext);

    if (!selectedValidator) {
        return null;
    }

    return (
        <Card className={cn("z-10 w-full", className)}>
            <CardHeader>
                <CardTitle>{selectedValidator.payload.name}</CardTitle>
                <CardDescription className="">
                    {selectedValidator.payload.description}
                </CardDescription>
            </CardHeader>
            <CardContent></CardContent>
        </Card>
    );
}
