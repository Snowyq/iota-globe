"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useState } from "react";
import ValidatorsTable from "./ValidatorsTable";

export function ValidatorsView({ className }: { className?: string }) {
    const [query, setQuery] = useState("");

    return (
        <Card
            size="sm"
            className={cn("h-fit w-full backdrop-blur-xs", className)}
        >
            <CardHeader>
                <CardTitle className="typo">Validators</CardTitle>
                <div className="relative w-full">
                    <Input
                        placeholder="Search validator by name"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="min-h-[600px] w-full">
                {/* <ScrollArea type="always" className="h-full min-h-0 w-full"> */}
                <ValidatorsTable query={query} />
                {/* </ScrollArea> */}
            </CardContent>
        </Card>
    );
}
