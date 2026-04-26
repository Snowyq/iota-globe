"use client";

import { InnerLink } from "@/components/InnerLink";
import { Stat } from "@/components/Stat";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { useContext } from "react";

export function ValidatorsCard({ className }: { className?: string }) {
    const { validators } = useContext(ValidatorsContext);

    const cities = new Set(validators.map((v) => v.geo?.city));
    const countries = new Set(validators.map((v) => v.geo?.country));

    const committeeCount = validators.filter((v) => v.isCommitteeMember).length;
    const activeCount = validators.length - committeeCount;

    return (
        <Card className={cn(className)}>
            <CardContent className="flex flex-col">
                <div className="mb-1 flex w-full items-baseline justify-between">
                    <CardTitle>Validators</CardTitle>
                    <InnerLink href={"/validators"} label="View all" />
                </div>
                <div className="flex items-center">
                    <div className="flex flex-1 justify-center">
                        <Stat
                            size={"lg"}
                            value={validators.length}
                            label="Total"
                        />
                    </div>
                    <Separator
                        orientation="vertical"
                        className="my-auto h-10 shrink-0"
                    />
                    <div className="flex flex-1 flex-col justify-center px-4">
                        <Stat
                            size={"sm"}
                            value={committeeCount}
                            innerClassName="justify-between"
                            sub="Committee"
                        />
                        <Stat
                            size={"sm"}
                            innerClassName="justify-between"
                            value={activeCount}
                            sub="Active"
                        />
                    </div>
                    <Separator
                        orientation="vertical"
                        className="my-auto h-10 shrink-0"
                    />
                    <div className="flex flex-1 flex-col justify-center px-4">
                        <Stat
                            size={"sm"}
                            innerClassName="justify-between"
                            value={cities.size}
                            sub="Cities"
                        />
                        <Stat
                            size={"sm"}
                            innerClassName="justify-between"
                            value={countries.size}
                            sub="Countries"
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
                </div>
            </CardContent>
        </Card>
    );
}
