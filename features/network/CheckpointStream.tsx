"use client";

import type { CheckpointStreamItem } from "@/app/api/checkpoints/stream/route";
import { useLiveStream, type StreamStatus } from "@/hooks/useLiveStream";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

// ~70 s at mainnet's ~5 checkpoints/s, enough for the one-minute trace.
const KEEP = 360;

type Listener = (item: CheckpointStreamItem) => void;

type CheckpointData = {
    // Newest first.
    blocks: CheckpointStreamItem[];
    status: StreamStatus;
};

const CheckpointDataContext = createContext<CheckpointData>({
    blocks: [],
    status: "connecting",
});
// Separate context so arrival-only consumers (the globe) don't re-render.
const CheckpointEventsContext = createContext<
    (listener: Listener) => () => void
>(() => () => {});

export type TpsSample = { timestamp: number; tps: number };
type ThroughputSamples = { samples: TpsSample[]; status: StreamStatus };
const ThroughputSamplesContext = createContext<ThroughputSamples>({
    samples: [],
    status: "connecting",
});
// Five minutes of one-second samples.
const SAMPLE_SECONDS = 300;
const SMOOTH_SECONDS = 5;

// Trailing mean per second from `first` to `last`, capped to SAMPLE_SECONDS.
function smoothed(buckets: Map<number, number>, first: number, last: number) {
    const series: TpsSample[] = [];
    for (let second = first; second <= last; second++) {
        let sum = 0,
            n = 0;
        for (let k = second - SMOOTH_SECONDS + 1; k <= second; k++)
            if (k >= first) {
                sum += buckets.get(k) ?? 0;
                n += 1;
            }
        series.push({ timestamp: second * 1000, tps: sum / n });
    }
    return series.slice(-SAMPLE_SECONDS);
}

const bySequence = (a: CheckpointStreamItem, b: CheckpointStreamItem) =>
    Number(b.sequenceNumber) - Number(a.sequenceNumber);

// One EventSource for all live widgets. Arrivals are flushed once per frame,
// so the replayed backlog costs one render.
export function CheckpointStreamProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [blocks, setBlocks] = useState<CheckpointStreamItem[]>([]);
    const listeners = useRef(new Set<Listener>());
    const head = useRef<number | null>(null);
    const pending = useRef<CheckpointStreamItem[]>([]);
    const frame = useRef<number | null>(null);
    // tx count per chain second
    const buckets = useRef(new Map<number, number>());
    const counted = useRef(new Set<string>());
    const lastSampled = useRef<number | null>(null);
    const [samples, setSamples] = useState<TpsSample[]>([]);
    const sample = useCallback(() => {
        const seconds = [...buckets.current.keys()].sort((a, b) => a - b);
        if (seconds.length < 2) return;
        // The newest second is still filling.
        const complete = seconds.at(-2)!;
        if (complete === lastSampled.current) return;
        lastSampled.current = complete;
        for (const second of seconds)
            if (second < complete - SAMPLE_SECONDS - SMOOTH_SECONDS)
                buckets.current.delete(second);
        const first = seconds.find((x) => buckets.current.has(x))!;
        setSamples(smoothed(buckets.current, first, complete));
    }, []);
    const flush = useCallback(() => {
        frame.current = null;
        const incoming = pending.current;
        pending.current = [];
        if (!incoming.length) return;
        for (const item of incoming) {
            if (counted.current.has(item.sequenceNumber)) continue;
            counted.current.add(item.sequenceNumber);
            const second = Math.floor(Number(item.timestampMs) / 1000);
            buckets.current.set(
                second,
                (buckets.current.get(second) ?? 0) + item.txCount
            );
        }
        if (counted.current.size > KEEP * 8)
            counted.current = new Set([...counted.current].slice(-KEEP * 4));
        sample();
        setBlocks((previous) => {
            const known = new Set(previous.map((b) => b.sequenceNumber));
            const fresh = incoming.filter((b) => {
                if (known.has(b.sequenceNumber)) return false;
                known.add(b.sequenceNumber);
                return true;
            });
            if (!fresh.length) return previous;
            return [...fresh, ...previous].sort(bySequence).slice(0, KEEP);
        });
    }, [sample]);
    useEffect(
        () => () => {
            if (frame.current != null) cancelAnimationFrame(frame.current);
        },
        []
    );
    useOnNetworkChange(() => {
        head.current = null;
        pending.current = [];
        buckets.current.clear();
        counted.current.clear();
        lastSampled.current = null;
        setBlocks([]);
        setSamples([]);
    });
    const push = useCallback(
        (item: CheckpointStreamItem) => {
            const seq = Number(item.sequenceNumber);
            if (head.current == null || seq > head.current) {
                head.current = seq;
                for (const listener of listeners.current) listener(item);
            }
            pending.current.push(item);
            // rAF pauses in hidden tabs, so cap the queue.
            if (pending.current.length > KEEP * 2)
                pending.current = pending.current.slice(-KEEP);
            frame.current ??= requestAnimationFrame(flush);
        },
        [flush]
    );
    const status = useLiveStream<CheckpointStreamItem>(
        "/api/checkpoints/stream",
        push
    );
    const onCheckpoint = useCallback((listener: Listener) => {
        listeners.current.add(listener);
        return () => void listeners.current.delete(listener);
    }, []);
    const data = useMemo(() => ({ blocks, status }), [blocks, status]);
    const throughput = useMemo(() => ({ samples, status }), [samples, status]);
    return (
        <CheckpointEventsContext.Provider value={onCheckpoint}>
            <ThroughputSamplesContext.Provider value={throughput}>
                <CheckpointDataContext.Provider value={data}>
                    {children}
                </CheckpointDataContext.Provider>
            </ThroughputSamplesContext.Provider>
        </CheckpointEventsContext.Provider>
    );
}

/** Per-second throughput of chain time, as a trailing 5 s mean. */
export const useThroughputSamples = () => useContext(ThroughputSamplesContext);

export const useCheckpointStream = () => useContext(CheckpointDataContext);
export const useCheckpointEvents = () => useContext(CheckpointEventsContext);

export type ThroughputTrace = {
    // tx/s over the last few seconds
    tps: number | null;
    // checkpoints/s over the same window
    rate: number | null;
    // per-second tx counts, oldest first
    seconds: number[];
    peak: number;
    mean: number | null;
};

const WINDOW_MS = 6_000;

/** Throughput from checkpoints: window tx count over its chain time span. */
export function throughputFrom(
    blocks: CheckpointStreamItem[],
    span = 60
): ThroughputTrace {
    const empty = { tps: null, rate: null, seconds: [], peak: 0, mean: null };
    if (blocks.length < 2) return empty;
    const newest = Number(blocks[0].timestampMs);
    let tx = 0,
        count = 0,
        oldest = newest;
    for (const block of blocks) {
        const ts = Number(block.timestampMs);
        if (newest - ts > WINDOW_MS) break;
        oldest = ts;
        count += 1;
        // The oldest block's txs predate the window; subtracted below.
        tx += block.txCount;
    }
    const windowSeconds = (newest - oldest) / 1000;
    const lastTx = count > 1 ? blocks[count - 1].txCount : 0;
    const tps = windowSeconds > 0 ? (tx - lastTx) / windowSeconds : null;
    const rate = windowSeconds > 0 ? (count - 1) / windowSeconds : null;

    const start = Math.floor(newest / 1000) - span + 1;
    const seconds = new Array<number>(span).fill(0);
    const covered = new Array<boolean>(span).fill(false);
    for (const block of blocks) {
        const slot = Math.floor(Number(block.timestampMs) / 1000) - start;
        if (slot < 0) break;
        if (slot < span) {
            seconds[slot] += block.txCount;
            covered[slot] = true;
        }
    }
    const first = covered.indexOf(true);
    const trace = first < 0 ? [] : seconds.slice(first);
    // Skip the still-filling current second.
    const settled = trace.slice(0, -1);
    return {
        tps,
        rate,
        seconds: trace,
        peak: Math.max(0, ...trace),
        mean: settled.length
            ? settled.reduce((a, b) => a + b, 0) / settled.length
            : null,
    };
}
