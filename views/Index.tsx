"use client";

import { useContext } from "react";
import { CalendarDays, WifiOff } from "lucide-react";
import {
    NetworkMetrics,
    NetworkResources,
} from "@/features/dashboard/NetworkMetrics";
import { GlobePanel } from "@/features/dashboard/GlobePanel";
import { StakePanel } from "@/features/dashboard/StakePanel";
import { EpochProgress } from "@/features/dashboard/EpochProgress";
import { ThroughputChart } from "@/features/dashboard/ThroughputChart";
import { ValidatorPreview } from "@/features/dashboard/ValidatorPreview";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { NetworkContext } from "@/features/network/NetworkContext";
import { useNowTime } from "@/hooks/useNowTime";

export default function Index() {
    const { error, updatedAt, refresh, isLoading } = useContext(NetworkContext);
    const now = useNowTime("minutes");
    return (
        <>
            <div className="overview-heading">
                <div>
                    <h1>Network overview</h1>
                    <p>A window into IOTA. Connected, distributed, alive.</p>
                </div>
                <span className="heading-date">
                    <CalendarDays size={13} />
                    {new Date(now).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Europe/Warsaw",
                    })}
                </span>
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
            <div className="dashboard-grid">
                <GlobePanel />
                <StakePanel />
            </div>
            <EpochProgress />
            <div className="analytics-grid">
                <ThroughputChart />
                <NetworkLiveCard />
            </div>
            <ValidatorPreview />
            <NetworkResources />
        </>
    );
}
