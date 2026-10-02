"use client";

import { useContext } from "react";
import { NetworkContext } from "@/features/network/NetworkContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { meanApy, totalStake } from "@/features/validators/stats";
import {
    Metric,
    Panel,
    PanelHeader,
    compact,
    nano,
} from "./DashboardPrimitives";

export function NetworkMetrics() {
    const {
        totalTransactions,
        addressMetrics,
        lastEpochTransactions,
        isLoading: networkLoading,
        networkMetrics,
    } = useContext(NetworkContext);
    const {
        validators,
        networkStats,
        isLoading: validatorsLoading,
    } = useContext(ValidatorsContext);
    const staked = networkStats ? totalStake(validators) : null;
    const averageApy = meanApy(validators);
    const committee = validators.filter((v) => v.isCommitteeMember).length;
    return (
        <div className="metrics-grid">
            <Metric
                label="Transactions, all time"
                isLoading={networkLoading && !networkMetrics}
                value={compact(totalTransactions)}
                detail={
                    <>
                        <b>+{compact(lastEpochTransactions)}</b> in the last
                        epoch
                    </>
                }
            />
            <Metric
                // Unit in the label so long values fit the narrow rail.
                label="Staked, IOTA"
                isLoading={validatorsLoading && !networkStats}
                value={compact(staked)}
                detail={
                    <>
                        Mean APY <b>{averageApy?.toFixed(2) ?? "—"}%</b>
                    </>
                }
            />
            <Metric
                label="Validators"
                isLoading={validatorsLoading && !networkStats}
                value={networkStats ? validators.length : null}
                detail={
                    <>
                        <b>{networkStats ? committee : "—"}</b> in the signing
                        committee
                    </>
                }
            />
            <Metric
                label="Addresses"
                isLoading={networkLoading && !networkMetrics}
                value={compact(addressMetrics?.cumulativeAddresses)}
                detail={
                    <>
                        <b>{compact(addressMetrics?.dailyActiveAddresses)}</b>{" "}
                        active today
                    </>
                }
            />
        </div>
    );
}

export function NetworkResources() {
    const {
        networkMetrics,
        circulatingSupply,
        addressMetrics,
        totalDelegators,
    } = useContext(NetworkContext);
    const { networkStats } = useContext(ValidatorsContext);
    const items = [
        {
            label: "Circulating supply",
            value: compact(nano(circulatingSupply?.value)),
            unit: "IOTA",
        },
        {
            label: "Total supply",
            value: compact(nano(networkStats?.iotaTotalSupply)),
            unit: "IOTA",
        },
        { label: "Delegators", value: compact(totalDelegators) },
        {
            label: "Move packages",
            value: compact(networkMetrics?.totalPackages),
        },
        {
            label: "Live objects",
            value: compact(networkMetrics?.totalObjects),
        },
        {
            label: "Addresses ever active",
            value: compact(addressMetrics?.cumulativeActiveAddresses),
        },
    ];
    return (
        <Panel className="resources-panel">
            <PanelHeader
                title="Ledger state"
                description="Supply, delegation and what lives on chain"
            />
            <dl className="resources-grid">
                {items.map(({ label, value, unit }) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                            {value}
                            {unit && value !== "—" && <small>{unit}</small>}
                        </dd>
                    </div>
                ))}
            </dl>
        </Panel>
    );
}
