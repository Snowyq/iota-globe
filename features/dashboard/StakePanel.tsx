"use client";

import { useContext } from "react";
import Link from "next/link";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { SkeletonBlock } from "@/components/Loading";
import {
    EmptyState,
    Panel,
    PanelHeader,
    TextLink,
    compact,
} from "./DashboardPrimitives";

const COLORS = ["#a99bff", "#7e9bff", "#63c9d5", "#5680b9", "#364257"];
export function StakePanel() {
    const { validators, isLoading, error, refresh } =
        useContext(ValidatorsContext);
    const sorted = [...validators].sort(
        (a, b) => b.stats.stakeIOTA - a.stats.stakeIOTA
    );
    const total = validators.reduce((sum, v) => sum + v.stats.stakeIOTA, 0);
    const top = sorted.slice(0, 4).map((v) => ({
        name: v.payload.name,
        stake: v.stats.stakeIOTA,
        href: `/validators/${v.iotaAddress}`,
    }));
    const other = sorted
        .slice(4)
        .reduce((sum, v) => sum + v.stats.stakeIOTA, 0);
    const segments = [
        ...top,
        ...(other
            ? [{ name: "Other validators", stake: other, href: "/validators" }]
            : []),
    ];
    let cursor = 0;
    const gradient = segments
        .map((s, i) => {
            const start = cursor;
            cursor += total ? (s.stake / total) * 100 : 0;
            return `${COLORS[i]} ${start}% ${cursor}%`;
        })
        .join(", ");
    const loading = isLoading && !validators.length;
    return (
        <Panel className="stake-panel" aria-busy={loading}>
            <PanelHeader
                title="Stake distribution"
                description="Delegated across the network"
                action={<TextLink href="/validators">Explore</TextLink>}
            />
            <div className="stake-content">
                {loading ? (
                    <>
                        <span className="sr-only" role="status">
                            Loading stake distribution
                        </span>
                        <div
                            key="donut"
                            className="stake-donut is-loading"
                            aria-hidden="true"
                        >
                            <div>
                                <SkeletonBlock className="skeleton-donut-label" />
                                <SkeletonBlock className="skeleton-donut-value" />
                                <SkeletonBlock className="skeleton-donut-unit" />
                            </div>
                        </div>
                        <div
                            key="legend"
                            className="stake-legend"
                            aria-hidden="true"
                        >
                            {Array.from({ length: 5 }, (_, i) => (
                                <div className="stake-legend-row" key={i}>
                                    <span
                                        className="legend-dot"
                                        style={{ background: "#344157" }}
                                    />
                                    <SkeletonBlock className="skeleton-legend-name" />
                                    <SkeletonBlock className="skeleton-legend-value" />
                                </div>
                            ))}
                        </div>
                    </>
                ) : !total ? (
                    <EmptyState
                        error={!!error}
                        title={
                            error
                                ? "Stake data unavailable"
                                : "No stake reported"
                        }
                        description={
                            error ??
                            "No stake balances are available for this network."
                        }
                        action={
                            error ? (
                                <button
                                    className="subtle-button"
                                    onClick={refresh}
                                >
                                    Try again
                                </button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div
                            key="donut"
                            className="stake-donut"
                            role="img"
                            aria-label={`${compact(total)} IOTA staked across ${validators.length} validators`}
                            style={{
                                background: `conic-gradient(from 220deg, ${gradient})`,
                            }}
                        >
                            <div>
                                <span>Total staked</span>
                                <strong>{compact(total)}</strong>
                                <small>IOTA</small>
                            </div>
                        </div>
                        <div key="legend" className="stake-legend">
                            {segments.map((s, i) => (
                                <Link
                                    className="stake-legend-row"
                                    href={s.href}
                                    key={s.href}
                                >
                                    <span
                                        className="legend-dot"
                                        style={{ background: COLORS[i] }}
                                    />
                                    <span>{s.name}</span>
                                    <b>
                                        {((s.stake / total) * 100).toFixed(1)}
                                        <small>%</small>
                                    </b>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div className="panel-bottom-note">
                {error && total
                    ? "Last available stake snapshot"
                    : "Stake balance per active validator"}
            </div>
        </Panel>
    );
}
