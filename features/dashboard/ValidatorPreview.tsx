"use client";

import { SkeletonBlock } from "@/components/Loading";
import { useContext } from "react";
import Link from "next/link";
import { ValidatorAvatar } from "@/components/ValidatorAvatar";
import { ArrowUpRight } from "lucide-react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import {
    EmptyState,
    Panel,
    PanelHeader,
    TextLink,
    compact,
} from "./DashboardPrimitives";

export function ValidatorPreview() {
    const { validators, isLoading, error, refresh } =
        useContext(ValidatorsContext);
    const top = [...validators]
        .sort((a, b) => b.stats.stakeIOTA - a.stats.stakeIOTA)
        .slice(0, 5);
    const max = top[0]?.stats.stakeIOTA || 1;
    return (
        <Panel
            className="validator-preview"
            aria-busy={isLoading && !validators.length}
        >
            <PanelHeader
                title="Leading validators"
                description="Ranked by total stake"
                action={<TextLink href="/validators">All validators</TextLink>}
            />
            <div className="validator-preview-body">
                {isLoading && !top.length ? (
                    <div className="validator-preview-list">
                        <span className="sr-only" role="status">
                            Loading leading validators
                        </span>
                        {Array.from({ length: 5 }, (_, i) => (
                            <div
                                className="validator-preview-row"
                                key={i}
                                aria-hidden="true"
                            >
                                <SkeletonBlock className="skeleton-rank" />
                                <span className="validator-name">
                                    <SkeletonBlock className="skeleton-avatar" />
                                    <div>
                                        <SkeletonBlock className="skeleton-validator-name" />
                                        <SkeletonBlock className="skeleton-validator-country" />
                                    </div>
                                </span>
                                <SkeletonBlock className="skeleton-stake-bar" />
                                <SkeletonBlock className="skeleton-stake-value" />
                                <SkeletonBlock className="skeleton-apy" />
                                <span />
                            </div>
                        ))}
                    </div>
                ) : !top.length ? (
                    <EmptyState
                        error={!!error}
                        title={
                            isLoading
                                ? "Loading validators"
                                : "No validator data"
                        }
                        description={error ?? undefined}
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
                    <div className="validator-preview-list">
                        {top.map((v, i) => (
                            <Link
                                className="validator-preview-row"
                                href={`/validators/${v.iotaAddress}`}
                                key={v.iotaAddress}
                            >
                                <span className="validator-rank">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="validator-name">
                                    <ValidatorAvatar
                                        name={v.payload.name}
                                        imageUrl={v.payload.imageUrl}
                                    />
                                    <div>
                                        <strong>{v.payload.name}</strong>
                                        <small>
                                            {v.geo?.country ??
                                                "Location unavailable"}
                                        </small>
                                    </div>
                                </span>
                                <div className="stake-bar">
                                    <span
                                        style={{
                                            width: `${(v.stats.stakeIOTA / max) * 100}%`,
                                        }}
                                    />
                                </div>
                                <span className="validator-preview-stake">
                                    {compact(v.stats.stakeIOTA)} IOTA
                                </span>
                                <span className="validator-preview-apy">
                                    {v.stats.apyPercent?.toFixed(2) ?? "—"}% APY
                                </span>
                                <ArrowUpRight
                                    size={13}
                                    className="text-muted-foreground"
                                />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </Panel>
    );
}
