"use client";

import { useContext } from "react";
import {
    Activity,
    Box,
    Code2,
    Coins,
    Layers3,
    ShieldCheck,
    Users,
} from "lucide-react";
import { NetworkContext } from "@/features/network/NetworkContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
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
    const totalStake = networkStats
        ? validators.reduce((s, v) => s + v.stats.stakeIOTA, 0)
        : null;
    const apys = validators.flatMap((v) =>
        v.stats.apyPercent == null ? [] : [v.stats.apyPercent]
    );
    const averageApy = apys.length
        ? apys.reduce((a, b) => a + b, 0) / apys.length
        : null;
    return (
        <div className="metrics-grid">
            <Metric
                label="Total transactions"
                isLoading={networkLoading && !networkMetrics}
                value={compact(totalTransactions)}
                detail={
                    <>
                        <span className="detail-dot" />
                        {compact(lastEpochTransactions)} in last epoch
                    </>
                }
                icon={Activity}
            />
            <Metric
                label="Total staked"
                isLoading={validatorsLoading && !networkStats}
                value={compact(totalStake)}
                unit="IOTA"
                detail={
                    <>
                        Average APY{" "}
                        <span className="text-lavender">
                            {averageApy?.toFixed(2) ?? "—"}%
                        </span>
                    </>
                }
                icon={Coins}
                tone="purple"
            />
            <Metric
                label="Active validators"
                isLoading={validatorsLoading && !networkStats}
                value={networkStats ? validators.length : null}
                detail={
                    <>
                        <span className="detail-dot teal" />
                        {networkStats
                            ? validators.filter((v) => v.isCommitteeMember)
                                  .length
                            : "—"}{" "}
                        committee members
                    </>
                }
                icon={ShieldCheck}
                tone="teal"
            />
            <Metric
                label="Total addresses"
                isLoading={networkLoading && !networkMetrics}
                value={compact(addressMetrics?.cumulativeAddresses)}
                detail={
                    <>
                        {compact(addressMetrics?.dailyActiveAddresses)} active
                        today
                    </>
                }
                icon={Users}
                tone="amber"
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
            label: "Move packages",
            value: compact(networkMetrics?.totalPackages),
            icon: Code2,
        },
        {
            label: "On-chain objects",
            value: compact(networkMetrics?.totalObjects),
            icon: Box,
        },
        {
            label: "Circulating supply",
            value: `${compact(nano(circulatingSupply?.value))} IOTA`,
            icon: Coins,
        },
        {
            label: "Total supply",
            value: `${compact(nano(networkStats?.iotaTotalSupply))} IOTA`,
            icon: Layers3,
        },
        {
            label: "Active addresses, all time",
            value: compact(addressMetrics?.cumulativeActiveAddresses),
            icon: Activity,
        },
        { label: "Delegators", value: compact(totalDelegators), icon: Users },
    ];
    return (
        <Panel className="resources-panel">
            <PanelHeader
                title="Network at a glance"
                description="The building blocks of the IOTA ecosystem"
            />
            <div className="resources-grid">
                {items.map(({ label, value, icon: Icon }) => (
                    <div key={label}>
                        <Icon size={17} strokeWidth={1.5} />
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                ))}
            </div>
        </Panel>
    );
}
