"use client";

import { ArrowLeft } from "lucide-react";
import {
    memo,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import type { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { useCheckpointStream } from "@/features/network/CheckpointStream";
import { useTransactionStream } from "@/features/network/TransactionStream";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { useNowTime } from "@/hooks/useNowTime";
import type { StreamStatus } from "@/hooks/useLiveStream";
import { shortString } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { StreamBadge } from "./DashboardPrimitives";

// ~12 s of checkpoints or a few seconds of transactions.
const KEEP = 60;

type View = "checkpoints" | "transactions";

type Card = {
    key: string;
    timestampMs: string | null;
    title: string;
    hint?: string;
    count: string;
    unit: string;
    fill: number;
};

const age = (now: number, timestampMs: string) => {
    const seconds = Math.max(0, (now - Number(timestampMs)) / 1000);
    return seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds));
};

const Block = memo(function Block({
    card,
    head,
}: {
    card: Card;
    head: boolean;
}) {
    return (
        <li
            className={`chain-block ${head ? "is-head" : ""}`}
            style={{ "--fill": `${card.fill}%` } as React.CSSProperties}
            data-ts={card.timestampMs ?? undefined}
            title={card.hint}
        >
            <span className="chain-seq">{card.title}</span>
            <span className="chain-meta">
                <b>{card.count}</b> {card.unit}
                <span className="chain-age" />
            </span>
        </li>
    );
});

const checkpointCards = (blocks: CheckpointStreamItem[]): Card[] => {
    const max = Math.max(1, ...blocks.map((b) => b.txCount));
    return blocks.map((b) => ({
        key: b.sequenceNumber,
        timestampMs: b.timestampMs,
        title: `#${Number(b.sequenceNumber).toLocaleString("en-US")}`,
        count: String(b.txCount),
        unit: "tx",
        fill: (b.txCount / max) * 100,
    }));
};

const transactionCards = (txs: TransactionStreamItem[]): Card[] => {
    const max = Math.max(1e-9, ...txs.map((t) => t.gasIOTA));
    return txs.map((t) => ({
        key: t.digest,
        timestampMs: t.timestampMs,
        title: shortString(t.digest, 5, 4),
        hint: t.digest,
        count: t.isSystem ? "sys" : String(t.txnsCount ?? "—"),
        unit: t.isSystem ? "" : "cmd",
        fill: (t.gasIOTA / max) * 100,
    }));
};

// Newest items enter on the left. Scrolling away pauses the track.
export function ChainStrip() {
    const [view, setView] = useState<View>("checkpoints");
    const { blocks, status: cpStatus } = useCheckpointStream();
    const { transactions, status: txStatus } = useTransactionStream();
    const [held, setHeld] = useState<Card[] | null>(null);
    const live = useMemo(
        () =>
            view === "checkpoints"
                ? checkpointCards(blocks.slice(0, KEEP))
                : transactionCards(transactions.slice(0, KEEP)),
        [view, blocks, transactions]
    );
    const status: StreamStatus = view === "checkpoints" ? cpStatus : txStatus;
    const cards = held ?? live;
    const heldIndex = held ? live.findIndex((c) => c.key === held[0]?.key) : 0;
    const unread = heldIndex < 0 ? live.length : heldIndex;
    const now = useNowTime(250);
    const trackRef = useRef<HTMLOListElement>(null);
    const headRef = useRef<string | null>(null);
    useOnNetworkChange(() => setHeld(null));

    // Ages are written to the DOM so the list only re-renders on new items.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        for (const li of track.children) {
            const ts = (li as HTMLElement).dataset.ts;
            const label = li.querySelector(".chain-age");
            if (!ts || !label) continue;
            const text = `${age(now, ts)}s`;
            // Edit the text node in place to avoid a relayout.
            if (label.firstChild) {
                if (label.firstChild.nodeValue !== text)
                    label.firstChild.nodeValue = text;
            } else label.textContent = text;
        }
    }, [now, cards]);

    // Slide new cards in from the left instead of jumping the row.
    const headKey = held ? null : (live[0]?.key ?? null);
    const previousLive = useRef<Card[]>([]);
    useLayoutEffect(() => {
        const previous = headRef.current;
        const before = previousLive.current;
        headRef.current = headKey;
        previousLive.current = live;
        const track = trackRef.current;
        if (previous == null || headKey == null || !track) return;
        const index = live.findIndex((c) => c.key === previous);
        const added = Math.min(index < 0 ? 0 : index, 4);
        if (added <= 0 || before === live) return;
        if (prefersReducedMotion()) return;
        const items = track.children;
        if (items.length < 2) return;
        const pitch =
            (items[1] as HTMLElement).offsetLeft -
            (items[0] as HTMLElement).offsetLeft;
        // Animate only the visible cards.
        const visible = Math.ceil(track.clientWidth / Math.max(1, pitch)) + 1;
        for (const el of [...items].slice(0, visible + added))
            (el as HTMLElement).animate(
                [
                    { transform: `translateX(${-pitch * added}px)` },
                    { transform: "translateX(0)" },
                ],
                { duration: 180, easing: "cubic-bezier(.2,.7,.3,1)" }
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headKey]);

    // Map vertical wheel to horizontal scroll.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const wheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            const max = track.scrollWidth - track.clientWidth;
            const next = Math.max(
                0,
                Math.min(max, track.scrollLeft + event.deltaY)
            );
            if (next === track.scrollLeft) return;
            event.preventDefault();
            track.scrollLeft = next;
        };
        track.addEventListener("wheel", wheel, { passive: false });
        return () => track.removeEventListener("wheel", wheel);
    }, []);

    const toLatest = () => {
        setHeld(null);
        trackRef.current?.scrollTo({ left: 0 });
    };
    const changeView = (next: View) => {
        setHeld(null);
        headRef.current = null;
        trackRef.current?.scrollTo({ left: 0 });
        setView(next);
    };

    const newest = blocks[0];
    const recent = blocks.slice(0, KEEP);
    const oldest = recent.at(-1);
    const spanSeconds =
        newest && oldest && newest !== oldest
            ? (Number(newest.timestampMs) - Number(oldest.timestampMs)) / 1000
            : null;
    const rate =
        spanSeconds && spanSeconds > 0
            ? (recent.length - 1) / spanSeconds
            : null;
    const txPerCheckpoint = recent.length
        ? recent.reduce((s, b) => s + b.txCount, 0) / recent.length
        : null;
    return (
        <section className="chain-strip" aria-labelledby="chain-title">
            <div className="chain-head">
                <h2 id="chain-title">Activity</h2>
                <div
                    className="live-tabs chain-tabs"
                    aria-label="Activity type"
                >
                    <button
                        aria-pressed={view === "checkpoints"}
                        onClick={() => changeView("checkpoints")}
                    >
                        Checkpoints
                    </button>
                    <button
                        aria-pressed={view === "transactions"}
                        onClick={() => changeView("transactions")}
                    >
                        Transactions
                    </button>
                </div>
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
                        <dt>Load</dt>
                        <dd>
                            {txPerCheckpoint != null
                                ? `${txPerCheckpoint.toFixed(1)} tx/cp`
                                : "—"}
                        </dd>
                    </div>
                </dl>
                <div className="chain-controls">
                    {held ? (
                        <button
                            className="chain-position is-held"
                            onClick={toLatest}
                        >
                            <ArrowLeft size={11} />
                            {unread
                                ? `${unread} new · latest`
                                : "Back to latest"}
                        </button>
                    ) : (
                        <span className="chain-position">
                            <i aria-hidden="true" />
                            At latest
                        </span>
                    )}
                    <StreamBadge status={status} />
                </div>
            </div>
            <ol
                className={`chain-track ${held ? "is-held" : ""} is-${view}`}
                ref={trackRef}
                aria-label={
                    view === "checkpoints"
                        ? "Most recent checkpoints, newest first"
                        : "Most recent transactions, newest first"
                }
                tabIndex={0}
                onScroll={(event) => {
                    const left = event.currentTarget.scrollLeft;
                    if (left > 8 && !held) setHeld(live);
                    else if (left <= 1 && held) setHeld(null);
                }}
            >
                {cards.length
                    ? cards.map((card, index) => (
                          <Block
                              key={card.key}
                              card={card}
                              head={index === 0 && !held}
                          />
                      ))
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
