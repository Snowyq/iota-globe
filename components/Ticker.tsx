"use client";

import { compact } from "@/features/dashboard/DashboardPrimitives";
import { NetworkContext } from "@/features/network/NetworkContext";
import { nakamotoCoefficient } from "@/features/validators/stats";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useContext } from "react";

// A tape of the network's headline figures. Every value is read from the
// shared providers; nothing here is fetched separately.
export function Ticker() {
    const { samples, totalTransactions, networkMetrics, addressMetrics } =
        useContext(NetworkContext);
    const { validators, networkStats } = useContext(ValidatorsContext);
    const staked = validators.reduce((s, v) => s + v.stats.stakeIOTA, 0);
    const nakamoto = nakamotoCoefficient(
        validators.map((v) => v.stats.stakePercent)
    );
    const items: [string, string][] = [
        ["TPS", samples.at(-1)?.tps.toFixed(2) ?? "—"],
        ["Total tx", compact(totalTransactions)],
        ["Epoch", networkStats ? `#${networkStats.epoch}` : "—"],
        [
            "Checkpoint",
            networkMetrics
                ? Number(networkMetrics.currentCheckpoint).toLocaleString(
                      "en-US"
                  )
                : "—",
        ],
        ["Staked", networkStats ? `${compact(staked)} IOTA` : "—"],
        ["Validators", networkStats ? String(validators.length) : "—"],
        ["Nakamoto", nakamoto == null ? "—" : String(nakamoto)],
        ["Addresses", compact(addressMetrics?.cumulativeAddresses)],
        ["30d peak TPS", networkMetrics?.tps30Days.toFixed(0) ?? "—"],
    ];
    const run = (hidden: boolean) => (
        <ul className="ticker-run" aria-hidden={hidden || undefined}>
            {items.map(([label, value]) => (
                <li key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                </li>
            ))}
        </ul>
    );
    return (
        <div className="ticker" aria-label="Network figures">
            <div className="ticker-track">
                {run(false)}
                {run(true)}
            </div>
        </div>
    );
}
