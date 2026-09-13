"use client";

import { ChartSkeleton } from "@/components/Loading";
import { useContext, useId, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { NetworkContext } from "@/features/network/NetworkContext";
import {
    EmptyState,
    Panel,
    PanelHeader,
    StreamBadge,
} from "./DashboardPrimitives";

const timeLabel = (time: number) =>
    new Date(time).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

export function ThroughputChart() {
    const { samples, streamStatus, networkMetrics } =
        useContext(NetworkContext);
    const [range, setRange] = useState(60);
    const id = useId().replace(/:/g, "");
    const latest = samples.at(-1);
    const data = latest
        ? samples.filter((s) => s.timestamp >= latest.timestamp - range * 1000)
        : [];
    const average = data.length
        ? data.reduce((sum, s) => sum + s.tps, 0) / data.length
        : null;
    const peak = data.length ? Math.max(...data.map((s) => s.tps)) : null;
    return (
        <Panel className="throughput-panel">
            <PanelHeader
                title="Network throughput"
                description="Transactions per second"
                action={
                    <div className="chart-actions">
                        <StreamBadge status={streamStatus} />
                        <div
                            className="segmented"
                            aria-label="Chart time window"
                        >
                            {[60, 300].map((value) => (
                                <button
                                    key={value}
                                    aria-pressed={range === value}
                                    onClick={() => setRange(value)}
                                >
                                    {value / 60}m
                                </button>
                            ))}
                        </div>
                    </div>
                }
            />
            <div className="chart-stats">
                <div>
                    <strong>{latest?.tps.toFixed(2) ?? "—"}</strong>
                    <span>tx/s</span>
                </div>
                <p>
                    Window avg <b>{average?.toFixed(2) ?? "—"}</b>
                </p>
                <p>
                    Window peak <b>{peak?.toFixed(2) ?? "—"}</b>
                </p>
                <p className="peak-30d">
                    30d peak{" "}
                    <b>{networkMetrics?.tps30Days.toFixed(2) ?? "—"}</b>
                </p>
            </div>
            <div
                className="throughput-chart"
                role="img"
                aria-label={`Live TPS chart. Current: ${latest?.tps.toFixed(2) ?? "unavailable"}. Window average: ${average?.toFixed(2) ?? "unavailable"}.`}
            >
                {data.length > 1 ? (
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                        initialDimension={{ width: 600, height: 176 }}
                    >
                        <AreaChart
                            data={data}
                            margin={{ top: 12, right: 6, left: -24, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient
                                    id={id}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor="#849bff"
                                        stopOpacity={0.3}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="#849bff"
                                        stopOpacity={0.01}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                stroke="#ffffff09"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="timestamp"
                                type="number"
                                domain={["dataMin", "dataMax"]}
                                tickFormatter={timeLabel}
                                tick={{ fill: "#8590a9", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={55}
                            />
                            <YAxis
                                tick={{ fill: "#8590a9", fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, "auto"]}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#171e31",
                                    border: "1px solid #30394e",
                                    borderRadius: 10,
                                    fontSize: 12,
                                }}
                                labelFormatter={(v) => timeLabel(Number(v))}
                                formatter={(v) => [
                                    `${Number(v).toFixed(2)} tx/s`,
                                    "Throughput",
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="tps"
                                stroke="#97a9ff"
                                strokeWidth={2}
                                fill={`url(#${id})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : streamStatus === "connecting" || streamStatus === "live" ? (
                    <ChartSkeleton />
                ) : (
                    <EmptyState
                        error={streamStatus === "reconnecting"}
                        title={
                            streamStatus === "reconnecting"
                                ? "Reconnecting to the network"
                                : "Waiting for throughput samples"
                        }
                        description="Sampling resumes automatically when the network responds."
                    />
                )}
            </div>
            <div className="chart-footnote">
                <span>
                    <i /> Live network samples
                </span>
                <span>Last {range / 60} min · collected this session</span>
            </div>
        </Panel>
    );
}
