"use client";

import { useEffect, useRef, useState } from "react";
import {
    mixFrom,
    useTransactionStream,
    type TransactionMix,
} from "@/features/network/TransactionStream";
import { Panel, PanelHeader, StreamBadge } from "./DashboardPrimitives";

const iota = (value: number | null) =>
    value == null ? "—" : value < 0.01 ? value.toFixed(4) : value.toFixed(3);

// Last-minute breakdown, re-read once a second so the numbers stay readable.
export function TransactionMixPanel() {
    const { transactions, status } = useTransactionStream();
    const latest = useRef(transactions);
    const [mix, setMix] = useState<TransactionMix | null>(null);
    useEffect(() => {
        latest.current = transactions;
    }, [transactions]);
    useEffect(() => {
        const read = () =>
            setMix(latest.current.length ? mixFrom(latest.current) : null);
        read();
        const timer = setInterval(read, 1_000);
        return () => clearInterval(timer);
    }, []);
    const userShare = mix && mix.count ? (mix.user / mix.count) * 100 : 0;
    const opsMax = Math.max(1, ...(mix?.ops.map((b) => b.count) ?? []));
    return (
        <Panel className="mix-panel" aria-label="Transaction mix, last minute">
            <PanelHeader
                title="Transaction mix"
                action={<StreamBadge status={status} />}
            />
            <div className="mix-now">
                <strong>
                    {mix?.perMinute == null
                        ? "—"
                        : Math.round(mix.perMinute).toLocaleString("en-US")}
                </strong>
                <span>
                    tx / min
                    <small>
                        {!mix
                            ? "Listening"
                            : mix.spanSeconds < 55
                              ? `${mix.count} seen in ${Math.round(mix.spanSeconds)} s so far`
                              : `${mix.count} in the last 60 s`}
                    </small>
                </span>
            </div>
            <div className="mix-split" aria-hidden="true">
                <i style={{ transform: `scaleX(${userShare / 100})` }} />
            </div>
            <div className="mix-split-legend">
                <span>
                    <i className="is-user" /> User {mix ? mix.user : "—"}
                </span>
                <span>
                    System {mix ? mix.system : "—"} <i className="is-system" />
                </span>
            </div>
            <dl className="mix-stats">
                <div>
                    <dt>Gas burned</dt>
                    <dd>
                        {iota(mix?.gasIOTA ?? null)}
                        <small> IOTA</small>
                    </dd>
                </div>
                <div>
                    <dt>Median fee</dt>
                    <dd>{iota(mix?.medianGas ?? null)}</dd>
                </div>
                <div>
                    <dt>Senders</dt>
                    <dd>{mix ? mix.senders : "—"}</dd>
                </div>
                <div>
                    <dt>Commands / tx</dt>
                    <dd>
                        {mix?.meanOps == null ? "—" : mix.meanOps.toFixed(1)}
                    </dd>
                </div>
            </dl>
            <div className="mix-ops">
                <span className="mix-ops-title">
                    Commands per user transaction
                </span>
                <ol>
                    {(mix?.ops ?? []).map((bucket) => (
                        <li key={bucket.label}>
                            <span>{bucket.label}</span>
                            <i
                                style={{
                                    transform: `scaleX(${bucket.count / opsMax})`,
                                }}
                            />
                            <b>{bucket.count}</b>
                        </li>
                    ))}
                </ol>
            </div>
        </Panel>
    );
}
