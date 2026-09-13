"use client";

import { ChartSkeleton } from "@/components/Loading";
import { useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { EpochRow } from "@/app/api/epochs/route";
import { EmptyState, Panel, PanelHeader, compact } from "./DashboardPrimitives";

export function EpochHistoryChart({
    epochs,
    isLoading,
    error,
}: {
    epochs: EpochRow[];
    isLoading: boolean;
    error: boolean;
}) {
    const [metric, setMetric] = useState<"transactions" | "rewards">(
        "transactions"
    );
    const data = [...epochs]
        .reverse()
        .filter((e) => e.epochEndTimestamp != null)
        .map((e) => ({
            epoch: e.epoch,
            transactions: Number(e.totalTransactions),
            rewards:
                e.stakeRewardsNano == null
                    ? null
                    : Number(e.stakeRewardsNano) / 1e9,
        }));
    return (
        <Panel>
            <PanelHeader
                title="Activity across epochs"
                description="Completed epochs on the current page"
                action={
                    <div className="segmented" aria-label="Epoch chart metric">
                        <button
                            aria-pressed={metric === "transactions"}
                            onClick={() => setMetric("transactions")}
                        >
                            Transactions
                        </button>
                        <button
                            aria-pressed={metric === "rewards"}
                            onClick={() => setMetric("rewards")}
                        >
                            Rewards
                        </button>
                    </div>
                }
            />
            <div
                className="epoch-chart"
                role="img"
                aria-label={`${metric === "transactions" ? "Transactions" : "Staking rewards in IOTA"} across ${data.length} completed epochs. Exact figures are available in the epoch table below.`}
            >
                {data.length ? (
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                        initialDimension={{ width: 600, height: 220 }}
                    >
                        <BarChart
                            data={data}
                            margin={{
                                top: 16,
                                right: 10,
                                left: -12,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid
                                stroke="#ffffff09"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="epoch"
                                tick={{ fill: "#8590a9", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={20}
                            />
                            <YAxis
                                tickFormatter={(v) => compact(v, 1)}
                                tick={{ fill: "#8590a9", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: "#a99bff07" }}
                                contentStyle={{
                                    background: "#171e31",
                                    border: "1px solid #30394e",
                                    borderRadius: 10,
                                    fontSize: 12,
                                }}
                                labelFormatter={(v) => `Epoch #${v}`}
                                formatter={(v) => [
                                    `${Number(v).toLocaleString("en-US")}${metric === "rewards" ? " IOTA" : ""}`,
                                    metric === "transactions"
                                        ? "Transactions"
                                        : "Rewards",
                                ]}
                            />
                            <Bar
                                dataKey={metric}
                                fill={
                                    metric === "transactions"
                                        ? "#929ce8"
                                        : "#6eafa9"
                                }
                                radius={[3, 3, 0, 0]}
                                maxBarSize={40}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : isLoading ? (
                    <ChartSkeleton
                        title="Loading epoch history"
                        description="Retrieving completed epochs and their rewards."
                    />
                ) : (
                    <EmptyState
                        error={error}
                        title={
                            isLoading
                                ? "Loading epoch history"
                                : "No completed epochs to display"
                        }
                        description="The chart uses completed epochs from the page below."
                    />
                )}
            </div>
        </Panel>
    );
}
