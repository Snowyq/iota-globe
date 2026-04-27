"use client";

import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import ValidatorsTable from "@/features/validators/ValidatorsTable";
import { Search } from "lucide-react";
import { useContext, useState } from "react";

type Tab = "all" | "committee" | "active" | "at-risk";

export default function ValidatorsPage() {
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<Tab>("all");
    const { validators } = useContext(ValidatorsContext);

    const committeeCount = validators.filter((v) => v.isCommitteeMember).length;
    const activeCount = validators.filter((v) => !v.isCommitteeMember).length;
    const atRiskCount = validators.filter((v) => v.isAtRisk).length;

    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: "all", label: "All", count: validators.length },
        { id: "committee", label: "Committee", count: committeeCount },
        { id: "active", label: "Active", count: activeCount },
        { id: "at-risk", label: "At Risk", count: atRiskCount },
    ];

    return (
        <Page>
            <div className="flex flex-col gap-3">
                <PageHeader
                    title="Validators"
                    description={`${validators.length} active validators on IOTA`}
                />

                <div className="flex flex-col items-center gap-4 @[40rem]:flex-row @[40rem]:items-center @[40rem]:gap-4">
                    <div className="relative w-full min-w-0">
                        <Input
                            placeholder="Search validator"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>

                    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                        <TabsList className="justify-center bg-secondary/30">
                            {tabs.map(({ id, label }) => (
                                <TabsTrigger
                                    key={id}
                                    value={id}
                                    className="flex shrink-0 flex-col gap-0.5 text-xs"
                                >
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            </div>
            <div className="min-h-200">
                <ValidatorsTable query={query} filter={tab} />
            </div>
        </Page>
    );
}
