"use client";

import { useEffect, useRef, useState } from "react";
import {
    useCheckpointEvents,
    useCheckpointStream,
} from "@/features/network/CheckpointStream";

// The stages one checkpoint passes through, sized by how long each takes.
const STAGES = [
    {
        ms: 200,
        took: "200 ms",
        clause: "First, validators certify a checkpoint, about five every second.",
    },
    {
        ms: 150,
        took: "150 ms",
        clause: "Then, within 150 ms, one server hub polls the RPC and fans it out to every open tab over SSE.",
    },
    {
        ms: 16,
        took: "16 ms",
        clause: "Next, on the following frame, arrivals merge into React state, so a backlog costs one render.",
    },
    {
        ms: 1200,
        took: "1.2 s",
        clause: "Last, the worker fires a 1.2-second pulse on the globe and the chain strip slides it in.",
    },
];
const total = STAGES.reduce((sum, stage) => sum + stage.ms, 0);

type Arrival = { seq: string; tx: number; lag: number };

export function DataFlow() {
    const onCheckpoint = useCheckpointEvents();
    const { status } = useCheckpointStream();
    const lane = useRef<HTMLDivElement>(null);
    const [last, setLast] = useState<Arrival | null>(null);
    const [count, setCount] = useState(0);

    useEffect(() => {
        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        let visible = true;
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
        });
        if (lane.current) observer.observe(lane.current);
        const stop = onCheckpoint((item) => {
            setLast({
                seq: Number(item.sequenceNumber).toLocaleString("en-US"),
                tx: item.txCount,
                lag: Math.max(0, Date.now() - Number(item.timestampMs)) / 1000,
            });
            setCount((n) => n + 1);
            const el = lane.current;
            if (reduced || !visible || !el || document.hidden) return;
            // One dot per real checkpoint, crossing the bar.
            const dot = document.createElement("i");
            dot.className = "flow-dot";
            el.appendChild(dot);
            const vertical = el.clientHeight > el.clientWidth;
            const run = vertical ? el.clientHeight : el.clientWidth;
            const axis = vertical ? "translateY" : "translateX";
            dot.animate(
                [
                    { transform: `${axis}(0px)`, opacity: 0 },
                    { opacity: 1, offset: 0.05 },
                    { opacity: 1, offset: 0.92 },
                    { transform: `${axis}(${run - 14}px)`, opacity: 0 },
                ],
                { duration: 2600, easing: "cubic-bezier(.3,.1,.3,1)" }
            ).onfinish = () => dot.remove();
        });
        return () => {
            stop();
            observer.disconnect();
        };
    }, [onCheckpoint]);

    return (
        <div className="flow">
            <div className="flow-bar" data-ui>
                {STAGES.map((stage) => (
                    <div
                        className="flow-stage"
                        key={stage.took}
                        style={{
                            flexGrow: Math.max(0.12, stage.ms / total),
                        }}
                    >
                        <div className="flow-segment">
                            <h3>{stage.took}</h3>
                        </div>
                        <p>{stage.clause}</p>
                    </div>
                ))}
                <div className="flow-lane" ref={lane} aria-hidden="true" />
            </div>
            <p className="flow-live" aria-live="off">
                <i className="motif-bullet" aria-hidden="true" />
                {last ? (
                    <>
                        Live from mainnet: checkpoint <b>#{last.seq}</b> with{" "}
                        <b>{last.tx}</b>{" "}
                        {last.tx === 1 ? "transaction" : "transactions"} reached
                        this page <b>{last.lag.toFixed(1)} s</b> after it was
                        certified. <b>{count.toLocaleString("en-US")}</b>{" "}
                        {count === 1 ? "checkpoint has" : "checkpoints have"}{" "}
                        crossed the bar since you opened it.
                    </>
                ) : status === "reconnecting" || status === "waiting" ? (
                    "The live stream is reconnecting; the bar shows the path each checkpoint takes."
                ) : (
                    "Connecting to the checkpoint stream. Each dot that crosses the bar will be a real mainnet checkpoint."
                )}
            </p>
        </div>
    );
}
