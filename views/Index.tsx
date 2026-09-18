"use client";

import { useContext } from "react";
import { WifiOff } from "lucide-react";
import {
    NetworkMetrics,
    NetworkResources,
} from "@/features/dashboard/NetworkMetrics";
import { ChainStrip } from "@/features/dashboard/ChainStrip";
import { GlobePanel } from "@/features/dashboard/GlobePanel";
import { StakePanel } from "@/features/dashboard/StakePanel";
import { EpochProgress } from "@/features/dashboard/EpochProgress";
import { ThroughputChart } from "@/features/dashboard/ThroughputChart";
import { ValidatorPreview } from "@/features/dashboard/ValidatorPreview";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { NetworkContext } from "@/features/network/NetworkContext";
import { OptionsContext } from "@/features/options/OptionsContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { formatDuration } from "@/lib/format";
import { useNowTime } from "@/hooks/useNowTime";

function OverviewFinding() {
    const { networkStats, validators } = useContext(ValidatorsContext);
    const now = useNowTime();
    if (!networkStats)
        return <p className="overview-finding">Reading system state…</p>;
    const start = Number(networkStats.epochStartTimestampMs);
    const duration = Number(networkStats.epochDurationMs);
    const progress = duration > 0 ? ((now - start) / duration) * 100 : null;
    const committee = validators.filter((v) => v.isCommitteeMember).length;
    return (
        <p className="overview-finding">
            Epoch <b>#{networkStats.epoch}</b> is{" "}
            <b>
                {progress == null ? "—" : Math.min(100, progress).toFixed(1)}%
            </b>{" "}
            through, closing in{" "}
            <b>{formatDuration(Math.max(0, start + duration - now))}</b>.{" "}
            <b>
                {committee} of {validators.length}
            </b>{" "}
            validators sign checkpoints.
        </p>
    );
}

export default function Index() {
    const { error, updatedAt, refresh, isLoading } = useContext(NetworkContext);
    const { network } = useContext(OptionsContext);
    return (
        <>
            <div className="overview-heading">
                <h1>
                    {network === "mainnet" ? "Mainnet" : "Testnet"} observatory
                </h1>
                <OverviewFinding />
            </div>
            {error && (
                <div className="error-banner" role="status">
                    <WifiOff size={16} />
                    <span>
                        {error}
                        {updatedAt && (
                            <small>
                                {" "}
                                Displaying the last available snapshot.
                            </small>
                        )}
                    </span>
                    <button
                        className="subtle-button ml-auto"
                        disabled={isLoading}
                        onClick={refresh}
                    >
                        {isLoading ? "Retrying…" : "Try again"}
                    </button>
                </div>
            )}
            <NetworkMetrics />
            <ChainStrip />
            <div className="dashboard-grid">
                <GlobePanel />
                <StakePanel />
            </div>
            <EpochProgress />
            <div className="analytics-grid">
                <ThroughputChart />
                <NetworkLiveCard />
            </div>
            <div className="ledger-grid">
                <ValidatorPreview />
                <NetworkResources />
            </div>
        </>
    );
}
