"use client";

import { useContext } from "react";
import Link from "next/link";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { nakamotoCoefficient } from "@/features/validators/stats";
import { SkeletonBlock } from "@/components/Loading";
import {
    EmptyState,
    Panel,
    PanelHeader,
    TextLink,
    compact,
} from "./DashboardPrimitives";

// Voting power decides consensus, so the panel leads with the smallest
// group able to halt it, then shows how the rest of the power is spread.
export function StakePanel() {
    const { validators, isLoading, error, refresh } =
        useContext(ValidatorsContext);
    const sorted = [...validators].sort(
        (a, b) => b.stats.stakePercent - a.stats.stakePercent
    );
    const totalStake = validators.reduce((s, v) => s + v.stats.stakeIOTA, 0);
    const totalPower = sorted.reduce((s, v) => s + v.stats.stakePercent, 0);
    const nakamoto = nakamotoCoefficient(
        sorted.map((v) => v.stats.stakePercent)
    );
    const haltingShare = nakamoto
        ? sorted
              .slice(0, nakamoto)
              .reduce((s, v) => s + v.stats.stakePercent, 0)
        : 0;
    const loading = isLoading && !validators.length;
    return (
        <Panel className="stake-panel" aria-busy={loading}>
            <PanelHeader
                title="Consensus power"
                description="Voting power across the committee"
                action={<TextLink href="/validators">Validators</TextLink>}
            />
            {loading ? (
                <div className="stake-content" aria-hidden="true">
                    <span className="sr-only" role="status">
                        Loading consensus power
                    </span>
                    <SkeletonBlock className="skeleton-nakamoto" />
                    <SkeletonBlock className="skeleton-power-bar" />
                    {Array.from({ length: 5 }, (_, i) => (
                        <SkeletonBlock key={i} className="skeleton-power-row" />
                    ))}
                </div>
            ) : !totalPower ? (
                <EmptyState
                    error={!!error}
                    title={
                        error
                            ? "Stake data unavailable"
                            : "No voting power reported"
                    }
                    description={
                        error ?? "No voting power is reported for this network."
                    }
                    action={
                        error ? (
                            <button className="subtle-button" onClick={refresh}>
                                Try again
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="stake-content">
                    <div className="nakamoto">
                        <strong>{nakamoto ?? "—"}</strong>
                        <p>
                            validators hold{" "}
                            <b>
                                {((haltingShare / totalPower) * 100).toFixed(1)}
                                %
                            </b>{" "}
                            of voting power — more than the third needed to halt
                            consensus.
                        </p>
                    </div>
                    <div
                        className="power-bar"
                        role="img"
                        aria-label={`Voting power of ${sorted.length} validators. The largest ${nakamoto} together exceed one third.`}
                    >
                        {sorted.map((v, i) => (
                            <span
                                key={v.iotaAddress}
                                className={
                                    nakamoto && i < nakamoto
                                        ? "is-halting"
                                        : undefined
                                }
                                style={{
                                    width: `${(v.stats.stakePercent / totalPower) * 100}%`,
                                }}
                            />
                        ))}
                        <i className="power-third" aria-hidden="true" />
                    </div>
                    <div className="power-scale" aria-hidden="true">
                        <span>0</span>
                        <span>⅓ halt</span>
                        <span>⅔ quorum</span>
                        <span>100%</span>
                    </div>
                    <ol className="power-list">
                        {sorted.slice(0, 7).map((v, i) => (
                            <li key={v.iotaAddress}>
                                <Link href={`/validators/${v.iotaAddress}`}>
                                    <span
                                        className={`power-swatch ${nakamoto && i < nakamoto ? "is-halting" : ""}`}
                                        aria-hidden="true"
                                    />
                                    <span className="power-name">
                                        {v.payload.name}
                                    </span>
                                    <span className="power-stake">
                                        {compact(v.stats.stakeIOTA)}
                                    </span>
                                    <b>{v.stats.stakePercent.toFixed(2)}%</b>
                                </Link>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
            <div className="panel-bottom-note">
                <span>
                    {error && totalPower
                        ? "Last available snapshot"
                        : `${compact(totalStake)} IOTA staked`}
                </span>
                <span>{validators.length} validators</span>
            </div>
        </Panel>
    );
}
