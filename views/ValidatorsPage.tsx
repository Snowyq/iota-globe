"use client";

import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/SearchField";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import ValidatorsTable from "@/features/validators/ValidatorsTable";
import { WifiOff } from "lucide-react";
import { useContext, useState } from "react";
import {
    EmptyState,
    Metric,
    Panel,
    PanelHeader,
    compact,
} from "@/features/dashboard/DashboardPrimitives";

type Tab = "all" | "committee" | "active" | "at-risk";

export default function ValidatorsPage() {
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<Tab>("all");
    const { validators, networkStats, isLoading, error, refresh } =
        useContext(ValidatorsContext);
    const committeeCount = validators.filter((v) => v.isCommitteeMember).length;
    const activeCount = validators.filter((v) => !v.isCommitteeMember).length;
    const atRiskCount = validators.filter((v) => v.isAtRisk).length;
    const total = validators.reduce((s, v) => s + v.stats.stakeIOTA, 0);
    const apys = validators.flatMap((v) =>
        v.stats.apyPercent == null ? [] : [v.stats.apyPercent]
    );
    const averageApy = apys.length
        ? apys.reduce((a, b) => a + b, 0) / apys.length
        : null;
    const countries = new Map<string, number>();
    validators.forEach((v) => {
        if (v.geo)
            countries.set(
                v.geo.country,
                (countries.get(v.geo.country) ?? 0) + 1
            );
    });
    const topCountries = [...countries].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const located = validators.filter((v) => v.geo).length;
    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: "all", label: "All validators", count: validators.length },
        { id: "committee", label: "Committee", count: committeeCount },
        { id: "active", label: "Non-committee", count: activeCount },
        { id: "at-risk", label: "At risk", count: atRiskCount },
    ];
    return (
        <Page>
            <PageHeader
                title="Validators"
                description="Every operator in the active set: stake, yield, commission and where their nodes answer from."
            />
            {error && (
                <div className="error-banner" role="status">
                    <WifiOff size={16} />
                    <span>{error}</span>
                    <button
                        className="subtle-button ml-auto"
                        disabled={isLoading}
                        onClick={refresh}
                    >
                        {isLoading ? "Retrying…" : "Retry"}
                    </button>
                </div>
            )}
            <div className="page-summary">
                <Metric
                    isLoading={isLoading && !networkStats}
                    label="Active set"
                    value={networkStats ? validators.length : null}
                    detail={`${committeeCount} in the committee`}
                />
                <Metric
                    isLoading={isLoading && !networkStats}
                    label="Delegated stake"
                    value={networkStats ? compact(total) : "—"}
                    unit="IOTA"
                    detail="Across active validators"
                />
                <Metric
                    isLoading={isLoading && !networkStats}
                    label="Mean APY"
                    value={averageApy?.toFixed(2)}
                    unit="%"
                    detail="Unweighted across validators"
                />
                <Metric
                    isLoading={isLoading && !networkStats}
                    label="Countries"
                    value={networkStats ? countries.size : null}
                    detail={`${located} of ${validators.length} validators geolocated`}
                />
            </div>
            <div className="validator-insights">
                <Panel>
                    <PanelHeader
                        title="Where validators run"
                        description="Top countries by node count · IP estimates"
                    />
                    <div className="country-bars">
                        {topCountries.length ? (
                            topCountries.map(([country, count]) => (
                                <div key={country}>
                                    <span>{country}</span>
                                    <div>
                                        <i
                                            style={{
                                                width: `${(count / (topCountries[0]?.[1] || 1)) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <b>{count}</b>
                                </div>
                            ))
                        ) : (
                            <EmptyState
                                title={
                                    isLoading
                                        ? "Locating validators"
                                        : "Locations unavailable"
                                }
                                description="Validator metrics remain available when geolocation cannot be resolved."
                            />
                        )}
                    </div>
                </Panel>
                <Panel>
                    <PanelHeader
                        title="Committee"
                        description="Who signs checkpoints this epoch"
                    />
                    <div className="participation-chart">
                        <div
                            className="participation-track"
                            role="img"
                            aria-label={`${committeeCount} committee members and ${activeCount} non-committee validators`}
                        >
                            <span
                                style={{
                                    width: `${validators.length ? (committeeCount / validators.length) * 100 : 0}%`,
                                }}
                            />
                        </div>
                        <div>
                            <span>
                                <i
                                    className="legend-dot"
                                    style={{ background: "var(--accent)" }}
                                />
                                Committee members
                                <strong>
                                    {networkStats ? committeeCount : "—"}
                                </strong>
                            </span>
                            <span>
                                <i
                                    className="legend-dot"
                                    style={{ background: "var(--line-strong)" }}
                                />
                                Non-committee
                                <strong>
                                    {networkStats ? activeCount : "—"}
                                </strong>
                            </span>
                            <span>
                                <i
                                    className="legend-dot"
                                    style={{ background: "var(--warning)" }}
                                />
                                Flagged at risk
                                <strong>
                                    {networkStats ? atRiskCount : "—"}
                                </strong>
                            </span>
                        </div>
                        <p>
                            Committee membership and risk flags come directly
                            from the current system state.
                        </p>
                    </div>
                </Panel>
            </div>
            <section className="table-panel" aria-label="Validator directory">
                <div className="table-toolbar">
                    <SearchField
                        label="Search validators by name, address or country"
                        placeholder="Search name, address or country…"
                        value={query}
                        onChange={setQuery}
                    />
                    <div className="filter-tabs" aria-label="Filter validators">
                        {tabs.map(({ id, label, count }) => (
                            <button
                                key={id}
                                aria-pressed={tab === id}
                                onClick={() => setTab(id)}
                            >
                                {label}
                                <span>{count}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <ValidatorsTable query={query} filter={tab} />
            </section>
        </Page>
    );
}
