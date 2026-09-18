"use client";

import type { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StreamBadge } from "./DashboardPrimitives";

const KEEP = 28;

// The ledger as it is written: each checkpoint the network certifies is
// appended as a block, filled in proportion to the transactions it carries.
export function ChainStrip() {
    const [blocks, setBlocks] = useState<CheckpointStreamItem[]>([]);
    const now = useNowTime(250);
    const trackRef = useRef<HTMLOListElement>(null);
    const headRef = useRef<number | null>(null);
    useOnNetworkChange(() => {
        headRef.current = null;
        setBlocks([]);
    });
    const push = useCallback(
        (item: CheckpointStreamItem) =>
            setBlocks((previous) =>
                previous.some((b) => b.sequenceNumber === item.sequenceNumber)
                    ? previous
                    : [item, ...previous]
                          .sort(
                              (a, b) =>
                                  Number(b.sequenceNumber) -
                                  Number(a.sequenceNumber)
                          )
                          .slice(0, KEEP)
            ),
        []
    );
    const status = useLiveStream<CheckpointStreamItem>(
        "/api/checkpoints/stream",
        push
    );
    const max = Math.max(1, ...blocks.map((b) => b.txCount));
    const newest = blocks[0];
    const headSeq = newest ? Number(newest.sequenceNumber) : null;
    // Conveyor: when new heads arrive, slide the chain in from the left by
    // the width they added instead of jumping a whole block at a time.
    useLayoutEffect(() => {
        const previous = headRef.current;
        headRef.current = headSeq;
        const track = trackRef.current;
        if (previous == null || headSeq == null || !track) return;
        const added = Math.min(headSeq - previous, 4);
        if (added <= 0) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;
        const items = track.children;
        if (items.length < 2) return;
        const pitch =
            (items[1] as HTMLElement).offsetLeft -
            (items[0] as HTMLElement).offsetLeft;
        for (const el of items)
            (el as HTMLElement).animate(
                [
                    { transform: `translateX(${-pitch * added}px)` },
                    { transform: "translateX(0)" },
                ],
                { duration: 180, easing: "cubic-bezier(.2,.7,.3,1)" }
            );
    }, [headSeq]);
    const oldest = blocks.at(-1);
    const spanSeconds =
        newest && oldest && newest !== oldest
            ? (Number(newest.timestampMs) - Number(oldest.timestampMs)) / 1000
            : null;
    const rate =
        spanSeconds && spanSeconds > 0
            ? (blocks.length - 1) / spanSeconds
            : null;
    const txPerCheckpoint = blocks.length
        ? blocks.reduce((s, b) => s + b.txCount, 0) / blocks.length
        : null;
    return (
        <section className="chain-strip" aria-labelledby="chain-title">
            <div className="chain-head">
                <h2 id="chain-title">Checkpoint chain</h2>
                <dl className="chain-stats">
                    <div>
                        <dt>Head</dt>
                        <dd>
                            {newest
                                ? `#${Number(newest.sequenceNumber).toLocaleString("en-US")}`
                                : "—"}
                        </dd>
                    </div>
                    <div>
                        <dt>Rate</dt>
                        <dd>{rate ? `${rate.toFixed(1)} cp/s` : "—"}</dd>
                    </div>
                    <div>
                        <dt>Mean load</dt>
                        <dd>
                            {txPerCheckpoint != null
                                ? `${txPerCheckpoint.toFixed(1)} tx/cp`
                                : "—"}
                        </dd>
                    </div>
                </dl>
                <StreamBadge status={status} />
            </div>
            <ol
                className="chain-track"
                ref={trackRef}
                aria-label="Most recent checkpoints, newest first"
                tabIndex={0}
            >
                {blocks.length
                    ? blocks.map((block, index) => {
                          const ageSeconds = Math.max(
                              0,
                              (now - Number(block.timestampMs)) / 1000
                          );
                          const age =
                              ageSeconds < 10
                                  ? ageSeconds.toFixed(1)
                                  : Math.round(ageSeconds);
                          return (
                              <li
                                  key={block.sequenceNumber}
                                  className={`chain-block ${index === 0 ? "is-head" : ""}`}
                                  style={
                                      {
                                          "--fill": `${(block.txCount / max) * 100}%`,
                                      } as React.CSSProperties
                                  }
                              >
                                  <span className="chain-seq">
                                      #
                                      {Number(
                                          block.sequenceNumber
                                      ).toLocaleString("en-US")}
                                  </span>
                                  <span className="chain-meta">
                                      <b>{block.txCount}</b> tx
                                      <span>{age}s</span>
                                  </span>
                              </li>
                          );
                      })
                    : Array.from({ length: 10 }, (_, i) => (
                          <li
                              key={i}
                              className="chain-block is-placeholder"
                              aria-hidden="true"
                          />
                      ))}
            </ol>
        </section>
    );
}
