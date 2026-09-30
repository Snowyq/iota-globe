import { describe, expect, it, vi } from "vitest";
import type { CheckpointStreamItem } from "@/lib/checkpointHub";
import type { TransactionStreamItem } from "@/lib/transactionHub";
import { throughputFrom } from "@/features/network/CheckpointStream";
import { mixFrom } from "@/features/network/TransactionStream";
import { hubStream } from "@/lib/hubStream";

const checkpoint = (
    sequenceNumber: number,
    timestampMs: number,
    txCount: number
): CheckpointStreamItem => ({
    sequenceNumber: String(sequenceNumber),
    timestampMs: String(timestampMs),
    txCount,
    epoch: "1",
});

const tx = (
    digest: string,
    timestampMs: number,
    overrides: Partial<TransactionStreamItem> = {}
): TransactionStreamItem => ({
    digest,
    sender: "0xa",
    isSystem: false,
    txnsCount: 1,
    gasIOTA: 1,
    timestampMs: String(timestampMs),
    checkpoint: "1",
    ...overrides,
});

describe("throughputFrom", () => {
    it("needs at least two checkpoints", () => {
        expect(throughputFrom([checkpoint(1, 1000, 5)])).toEqual({
            tps: null,
            rate: null,
            seconds: [],
            peak: 0,
            mean: null,
        });
    });

    it("computes rate and per-second buckets", () => {
        // Newest first; the oldest only opens the window.
        const trace = throughputFrom([
            checkpoint(3, 2000, 4),
            checkpoint(2, 1500, 6),
            checkpoint(1, 1000, 10),
        ]);
        expect(trace.tps).toBe(10);
        expect(trace.rate).toBe(2);
        expect(trace.seconds).toEqual([16, 4]);
        expect(trace.peak).toBe(16);
        // The second still filling is left out of the mean.
        expect(trace.mean).toBe(16);
    });

    it("only counts the last six seconds toward the rate", () => {
        const trace = throughputFrom([
            checkpoint(3, 10_000, 3),
            checkpoint(2, 9_000, 3),
            checkpoint(1, 1_000, 500),
        ]);
        expect(trace.tps).toBe(3);
        expect(trace.rate).toBe(1);
    });
});

describe("mixFrom", () => {
    it("summarises the last minute of transactions", () => {
        const mix = mixFrom([
            tx("d", 60_000, { gasIOTA: 3, txnsCount: 1, sender: "0xa" }),
            tx("c", 30_000, { isSystem: true, gasIOTA: 0, txnsCount: null }),
            tx("b", 0, { gasIOTA: 1, txnsCount: 4, sender: "0xb" }),
            // Outside the window.
            tx("a", -1_000, { gasIOTA: 100, txnsCount: 20 }),
        ]);
        expect(mix.count).toBe(3);
        expect(mix.spanSeconds).toBe(60);
        expect(mix.perMinute).toBe(3);
        expect(mix.user).toBe(2);
        expect(mix.system).toBe(1);
        expect(mix.gasIOTA).toBe(4);
        expect(mix.medianGas).toBe(3);
        expect(mix.meanOps).toBe(2.5);
        expect(mix.senders).toBe(2);
        expect(mix.ops).toEqual([
            { label: "1", count: 1 },
            { label: "2", count: 0 },
            { label: "3–5", count: 1 },
            { label: "6–10", count: 0 },
            { label: "11+", count: 0 },
        ]);
    });

    it("has no rate for a very short sample", () => {
        const mix = mixFrom([tx("b", 1_000), tx("a", 0)]);
        expect(mix.perMinute).toBeNull();
    });
});

describe("hubStream", () => {
    it("forwards hub items as SSE and unsubscribes on abort", async () => {
        const unsubscribe = vi.fn();
        let emit: (item: { n: number }) => void = () => {};
        const controller = new AbortController();
        const response = hubStream<{ n: number }>(
            new Request("http://localhost/stream", {
                signal: controller.signal,
            }),
            (listener) => {
                emit = listener;
                return unsubscribe;
            }
        );
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
        expect(response.headers.get("X-Accel-Buffering")).toBe("no");

        const reader = response.body!.getReader();
        emit({ n: 7 });
        const { value } = await reader.read();
        expect(new TextDecoder().decode(value)).toBe('data: {"n":7}\n\n');

        controller.abort();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect((await reader.read()).done).toBe(true);
    });
});
