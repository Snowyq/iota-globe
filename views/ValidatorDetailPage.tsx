"use client";

import { CopyButton } from "@/components/CopyButton";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { ValidatorAvatar } from "@/components/ValidatorAvatar";
import {
    EmptyState,
    Metric,
    Panel,
    PanelHeader,
    compact,
    nano,
} from "@/features/dashboard/DashboardPrimitives";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { ArrowLeft, ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useContext, useEffect } from "react";

function projectUrl(value: string) {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

export default function ValidatorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { validators, isLoading, error, selectValidator, refresh } =
        useContext(ValidatorsContext);
    const validator = validators.find((v) => v.iotaAddress === id);
    useEffect(() => {
        if (validator) selectValidator?.(validator.iotaAddress);
    }, [validator, selectValidator]);
    if (!validator)
        return (
            <Page>
                <Link className="text-link" href="/validators">
                    <ArrowLeft size={14} />
                    All validators
                </Link>
                <PageHeader title="Validator details" />
                <Panel>
                    <EmptyState
                        error={!!error}
                        title={
                            isLoading
                                ? "Loading validator"
                                : error
                                  ? "Validator data unavailable"
                                  : "Validator not found"
                        }
                        description={
                            isLoading
                                ? "Fetching the current active validator set."
                                : (error ??
                                  "This address is not in the active validator set for the selected network. Choose another validator or switch networks.")
                        }
                        action={
                            error ? (
                                <button
                                    className="subtle-button"
                                    disabled={isLoading}
                                    onClick={refresh}
                                >
                                    {isLoading ? "Retrying…" : "Retry"}
                                </button>
                            ) : undefined
                        }
                    />
                </Panel>
            </Page>
        );
    const { payload, stats, iotaAddress, geo } = validator;
    const commission = Number(payload.effectiveCommissionRate) / 100;
    const nextCommission = Number(payload.nextEpochCommissionRate) / 100;
    const nextStake = nano(payload.nextEpochStake);
    const stakeDelta = nextStake == null ? null : nextStake - stats.stakeIOTA;
    const totalStake = validators.reduce((s, v) => s + v.stats.stakeIOTA, 0);
    const stakeShare =
        totalStake > 0 ? (stats.stakeIOTA / totalStake) * 100 : 0;
    const rank =
        [...validators]
            .sort((a, b) => b.stats.stakePercent - a.stats.stakePercent)
            .findIndex((v) => v.iotaAddress === iotaAddress) + 1;
    const url = projectUrl(payload.projectUrl);
    const identity = [
        { label: "Validator address", value: iotaAddress },
        { label: "Staking pool ID", value: payload.stakingPoolId },
        { label: "Protocol public key", value: payload.protocolPubkeyBytes },
    ];
    return (
        <Page>
            <Link className="text-link" href="/validators">
                <ArrowLeft size={14} />
                All validators
            </Link>
            {error && (
                <div className="error-banner" role="status">
                    <span>{error} Displaying the last available snapshot.</span>
                    <button
                        className="subtle-button ml-auto"
                        disabled={isLoading}
                        onClick={refresh}
                    >
                        {isLoading ? "Retrying…" : "Retry"}
                    </button>
                </div>
            )}
            <div className="detail-hero">
                <ValidatorAvatar
                    name={payload.name}
                    imageUrl={payload.imageUrl}
                />
                <div>
                    <div className="detail-hero-meta">
                        <h1>{payload.name}</h1>
                        <span className="detail-status">
                            <ShieldCheck size={11} />
                            {validator.isCommitteeMember
                                ? "Committee member"
                                : "Active validator"}
                        </span>
                        {validator.isAtRisk && (
                            <span className="risk-label">
                                At risk
                                {validator.atRiskGracePeriod
                                    ? ` · ${validator.atRiskGracePeriod} epochs`
                                    : ""}
                            </span>
                        )}
                    </div>
                    <p>
                        {payload.description ||
                            "No description published on chain."}
                    </p>
                    {url && (
                        <a
                            className="text-link"
                            href={url.href}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {url.hostname}
                            <ArrowUpRight size={13} />
                        </a>
                    )}
                    <div className="detail-location">
                        <MapPin size={12} />
                        {geo
                            ? `${geo.city}, ${geo.country} · IP-based location`
                            : "Geolocation unavailable"}
                    </div>
                </div>
            </div>
            <div className="page-summary">
                <Metric
                    label="Total staked"
                    value={compact(stats.stakeIOTA)}
                    unit="IOTA"
                    detail={`${stakeShare.toFixed(2)}% of active validator stake`}
                />
                <Metric
                    label="Staking APY"
                    value={stats.apyPercent?.toFixed(2)}
                    unit="%"
                    detail="Reported validator APY"
                />
                <Metric
                    label="Commission"
                    value={
                        Number.isFinite(commission)
                            ? commission.toFixed(2)
                            : null
                    }
                    unit="%"
                    detail="Effective commission rate"
                />
                <Metric
                    label="Voting power"
                    value={stats.stakePercent.toFixed(2)}
                    unit="%"
                    detail="Share of network voting power"
                />
            </div>
            <div className="detail-analysis-grid">
                <Panel>
                    <PanelHeader
                        title="Stake outlook"
                        description="Current balance and the next epoch"
                    />
                    <div className="stake-outlook">
                        <div>
                            <span>Current epoch</span>
                            <strong>
                                {compact(stats.stakeIOTA)}
                                <small>IOTA</small>
                            </strong>
                            <div className="outlook-bar">
                                <i
                                    style={{
                                        width: `${(stats.stakeIOTA / Math.max(stats.stakeIOTA, nextStake ?? 0, 1)) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <span>Next epoch</span>
                            <strong>
                                {compact(nextStake)}
                                <small>IOTA</small>
                            </strong>
                            <div className="outlook-bar next">
                                <i
                                    style={{
                                        width: `${((nextStake ?? 0) / Math.max(stats.stakeIOTA, nextStake ?? 0, 1)) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                        <p>
                            Expected change{" "}
                            <b
                                className={
                                    stakeDelta != null && stakeDelta >= 0
                                        ? "positive"
                                        : ""
                                }
                            >
                                {stakeDelta == null
                                    ? "—"
                                    : `${stakeDelta >= 0 ? "+" : ""}${compact(stakeDelta)} IOTA`}
                            </b>
                        </p>
                    </div>
                </Panel>
                <Panel>
                    <PanelHeader
                        title="Share of the active set"
                        description="Stake held against all active validators"
                    />
                    <div className="voting-visual">
                        <div
                            className="voting-gauge"
                            role="img"
                            aria-label={`${stakeShare.toFixed(2)} percent of total active stake`}
                            style={{
                                background: `conic-gradient(var(--accent) 0% ${stakeShare}%, var(--raised) ${stakeShare}% 100%)`,
                            }}
                        >
                            <div>
                                <strong>
                                    {stakeShare.toFixed(2)}
                                    <small>%</small>
                                </strong>
                                <span>of active stake</span>
                            </div>
                        </div>
                        <div className="voting-description">
                            <strong>
                                Rank {rank} of {validators.length} by voting
                                power
                            </strong>
                            <p>
                                {payload.name} carries{" "}
                                {stats.stakePercent.toFixed(2)}% of the votes
                                that certify each checkpoint.{" "}
                                {validator.isCommitteeMember
                                    ? "It signs in the current committee."
                                    : "It is outside the current committee."}
                            </p>
                        </div>
                    </div>
                </Panel>
            </div>
            <Panel>
                <PanelHeader
                    title="Staking economics"
                    description="Rewards and parameters reported by the network"
                />
                <div className="economics-grid">
                    <div>
                        <span>Last epoch reward</span>
                        <strong>
                            {compact(stats.lastEpochRewardIOTA)}
                            <small>IOTA</small>
                        </strong>
                    </div>
                    <div>
                        <span>Rewards pool</span>
                        <strong>
                            {compact(nano(payload.rewardsPool))}
                            <small>IOTA</small>
                        </strong>
                    </div>
                    <div>
                        <span>Next epoch commission</span>
                        <strong>
                            {Number.isFinite(nextCommission)
                                ? nextCommission.toFixed(2)
                                : "—"}
                            <small>%</small>
                        </strong>
                    </div>
                    <div>
                        <span>Committee status</span>
                        <strong className="economics-status">
                            {validator.isCommitteeMember
                                ? "Committee member"
                                : "Non-committee"}
                        </strong>
                    </div>
                </div>
            </Panel>
            <Panel>
                <PanelHeader
                    title="On-chain identity"
                    description="Public identifiers for this validator"
                />
                <dl className="identity-list">
                    {identity.map((item) => (
                        <div key={item.label}>
                            <dt>{item.label}</dt>
                            <dd>
                                <code>{item.value}</code>
                                <CopyButton
                                    value={item.value}
                                    label={`Copy ${item.label.toLowerCase()}`}
                                />
                            </dd>
                        </div>
                    ))}
                </dl>
            </Panel>
        </Page>
    );
}
