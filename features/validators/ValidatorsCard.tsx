"use client";

import { InnerLink } from "@/components/InnerLink";
import { Stat } from "@/components/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { useContext } from "react";
import { OptionsContext } from "../options/OptionsContext";

export function ValidatorsCard({ className }: { className?: string }) {
    const { validators } = useContext(ValidatorsContext);
    const { isFullscreen } = useContext(OptionsContext);

    const cities = new Set(validators.map((v) => v.geo?.city));
    const countries = new Set(validators.map((v) => v.geo?.country));

    const committeeCount = validators.filter((v) => v.isCommitteeMember).length;
    const activeCount = validators.length - committeeCount;

    return (
        <Card className={cn(className)}>
            <CardHeader className="flex w-full items-baseline justify-between">
                <CardTitle>Validators</CardTitle>
                <InnerLink href={"/validators"} label="View all" />
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <div className="flex min-w-15 flex-1 justify-center">
                    <Stat size={"lg"} value={validators.length} label="Total" />
                </div>
                <div
                    className={cn(
                        "flex flex-1 justify-center gap-2",
                        isFullscreen ? "flex-row gap-4" : "flex-col"
                    )}
                >
                    <Stat
                        size={"sm"}
                        value={committeeCount}
                        label="Committee"
                    />
                    <Stat size={"sm"} value={activeCount} label="Active" />
                </div>

                <div
                    className={cn(
                        "flex flex-1 justify-center gap-2",
                        isFullscreen ? "flex-row gap-4" : "flex-col"
                    )}
                >
                    <Stat size={"sm"} value={cities.size} label="Cities" />
                    <Stat
                        size={"sm"}
                        value={countries.size}
                        label="Countries"
                    />
                </div>
                {/* <div className="flex flex-col">
                        <Stat size={"sm"} value={cities.size} label="Cities" />
                        <Stat
                            size={"sm"}
                            value={countries.size}
                            label="Countries"
                        />
                    </div> */}
            </CardContent>
        </Card>
    );
}
