"use client";

import { useContext } from "react";
import { NetworkContext } from "@/features/network/NetworkContext";
import { TransactionStreamProvider } from "@/features/network/TransactionStream";
import { OptionsContext } from "@/features/options/OptionsContext";
import { ChainStrip } from "./ChainStrip";
import { ErrorBanner } from "./DashboardPrimitives";
import { EpochProgress } from "./EpochProgress";
import { GlobePanel } from "./GlobePanel";
import { NetworkMetrics } from "./NetworkMetrics";
import { StakePanel } from "./StakePanel";
import { ThroughputReadout } from "./ThroughputReadout";
import { TransactionMixPanel } from "./TransactionMixPanel";

function ConnectionError() {
    const { error, updatedAt, refresh, isLoading } = useContext(NetworkContext);
    if (!error) return null;
    return (
        <ErrorBanner
            onRetry={refresh}
            retrying={isLoading}
            retryLabel="Try again"
        >
            {error}
            {updatedAt && (
                <small> Displaying the last available snapshot.</small>
            )}
        </ErrorBanner>
    );
}

// Globe in the middle, panels docked around it (stacked below on mobile).
export function Observatory() {
    const { network } = useContext(OptionsContext);
    return (
        <TransactionStreamProvider>
            <section
                className="observatory"
                aria-labelledby="observatory-title"
            >
                <GlobePanel />
                <div className="hud">
                    <header className="hud-head">
                        <h1 id="observatory-title" className="sr-only">
                            {network === "mainnet" ? "Mainnet" : "Testnet"}{" "}
                            observatory
                        </h1>
                        <ConnectionError />
                    </header>
                    <div className="hud-rail hud-left">
                        <section
                            className="panel hud-ledger"
                            aria-label="Ledger"
                        >
                            <div className="panel-heading">
                                <h2>Ledger</h2>
                            </div>
                            <NetworkMetrics />
                        </section>
                        <StakePanel />
                    </div>
                    <div className="hud-rail hud-right">
                        <ThroughputReadout />
                        <TransactionMixPanel />
                    </div>
                    <div className="hud-bottom">
                        <ChainStrip />
                        <EpochProgress />
                    </div>
                </div>
            </section>
        </TransactionStreamProvider>
    );
}
