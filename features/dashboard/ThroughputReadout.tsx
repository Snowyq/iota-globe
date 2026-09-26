"use client";

import { useMemo } from "react";
import {
    throughputFrom,
    useCheckpointStream,
} from "@/features/network/CheckpointStream";
import { Panel, PanelHeader, StreamBadge } from "./DashboardPrimitives";

const SPAN = 60;

// Throughput as the chain writes it: recomputed on every certified
// checkpoint (~5 times a second), with the last minute traced per second.
export function ThroughputReadout() {
    const { blocks, status } = useCheckpointStream();
    const trace = useMemo(() => throughputFrom(blocks, SPAN), [blocks]);
    const scale = Math.max(1, trace.peak);
    const pad = SPAN - trace.seconds.length;
    return (
        <Panel className="tps-readout" aria-label="Live throughput">
            <PanelHeader
                title="Throughput"
                action={<StreamBadge status={status} />}
            />
            <div className="tps-now">
                <strong>
                    {trace.tps == null ? "—" : trace.tps.toFixed(1)}
                </strong>
                <span>
                    tx/s
                    <small>last 6 s on chain</small>
                </span>
            </div>
            <div
                className="tps-trace"
                role="img"
                aria-label={
                    trace.mean == null
                        ? "Collecting the last minute of throughput"
                        : `Last minute: mean ${trace.mean.toFixed(1)}, peak ${trace.peak} transactions per second`
                }
            >
                {Array.from({ length: pad }, (_, i) => (
                    <i key={`pad-${i}`} className="is-empty" />
                ))}
                {trace.seconds.map((value, i) => (
                    <i
                        key={i}
                        className={
                            i === trace.seconds.length - 1
                                ? "is-filling"
                                : value === trace.peak
                                  ? "is-peak"
                                  : undefined
                        }
                        // Scaled rather than resized: the bars move every
                        // checkpoint, and a transform skips layout.
                        style={{
                            transform: `scaleY(${Math.max(0.03, value / scale)})`,
                        }}
                    />
                ))}
            </div>
            <div className="tps-axis" aria-hidden="true">
                <span>−60 s</span>
                <span>now</span>
            </div>
            <dl className="tps-stats">
                <div>
                    <dt>Checkpoints</dt>
                    <dd>
                        {trace.rate == null
                            ? "—"
                            : `${trace.rate.toFixed(1)}/s`}
                    </dd>
                </div>
                <div>
                    <dt>Mean 60 s</dt>
                    <dd>{trace.mean == null ? "—" : trace.mean.toFixed(1)}</dd>
                </div>
                <div>
                    <dt>Peak 60 s</dt>
                    <dd>{trace.mean == null ? "—" : trace.peak}</dd>
                </div>
            </dl>
        </Panel>
    );
}
