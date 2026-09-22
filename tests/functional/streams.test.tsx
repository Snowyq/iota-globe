import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CheckpointStreamProvider,
    useCheckpointEvents,
    useCheckpointStream,
    useThroughputSamples,
} from "@/features/network/CheckpointStream";
import {
    TransactionStreamProvider,
    useTransactionStream,
} from "@/features/network/TransactionStream";
import { TestNetwork } from "../helpers/providers";
import { installEventSource, TestEventSource } from "../helpers/eventSource";

beforeEach(() => {
    installEventSource();
    vi.useFakeTimers();
    // jsdom paints no frames; a frame here is one timer tick.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

const checkpoint = (sequence: number, second: number, txCount = 1) => ({
    sequenceNumber: String(sequence),
    timestampMs: String(second * 1000),
    txCount,
    epoch: "1",
});

function Chain({
    onRender,
    onArrival,
}: {
    onRender?: (sequences: string[]) => void;
    onArrival?: (sequence: string) => void;
}) {
    const { blocks, status } = useCheckpointStream();
    const { samples } = useThroughputSamples();
    const subscribe = useCheckpointEvents();
    useEffect(
        () =>
            onArrival
                ? subscribe((item) => onArrival(item.sequenceNumber))
                : undefined,
        [subscribe, onArrival]
    );
    const sequences = blocks.map((b) => b.sequenceNumber);
    onRender?.(sequences);
    return (
        <>
            <output aria-label="Blocks">{sequences.join(",")}</output>
            <output aria-label="Status">{status}</output>
            <output aria-label="Samples">
                {samples.map((s) => `${s.timestamp / 1000}:${s.tps}`).join(",")}
            </output>
        </>
    );
}

function renderChain(
    props: Parameters<typeof Chain>[0] = {},
    network: "mainnet" | "testnet" = "mainnet"
) {
    const view = render(
        <TestNetwork network={network}>
            <CheckpointStreamProvider>
                <Chain {...props} />
            </CheckpointStreamProvider>
        </TestNetwork>
    );
    return {
        ...view,
        source: () => TestEventSource.instances.at(-1)!,
        switchTo: (next: "mainnet" | "testnet") =>
            view.rerender(
                <TestNetwork network={next}>
                    <CheckpointStreamProvider>
                        <Chain {...props} />
                    </CheckpointStreamProvider>
                </TestNetwork>
            ),
    };
}

describe("checkpoint stream", () => {
    it("merges a burst into one render, newest first, without repeats", () => {
        const renders: string[][] = [];
        const { source } = renderChain({ onRender: (s) => renders.push(s) });
        expect(source().url).toBe("/api/checkpoints/stream?dataset=mainnet");
        act(() => {
            source().emit(checkpoint(10, 100));
            source().emit(checkpoint(12, 100));
            source().emit(checkpoint(11, 100));
            source().emit(checkpoint(12, 100));
        });
        expect(screen.getByLabelText("Blocks")).toHaveTextContent("");
        act(() => vi.advanceTimersByTime(16));
        expect(screen.getByLabelText("Blocks")).toHaveTextContent("12,11,10");
        expect(screen.getByLabelText("Status")).toHaveTextContent("live");
        // No render ever showed part of the burst.
        expect(renders.filter((s) => s.length > 0 && s.length < 3)).toEqual([]);
    });

    it("tells listeners only about checkpoints that move the head forward", () => {
        const onArrival = vi.fn();
        const { source } = renderChain({ onArrival });
        act(() => {
            source().emit(checkpoint(10, 100));
            source().emit(checkpoint(12, 100));
            source().emit(checkpoint(11, 100));
        });
        expect(onArrival.mock.calls.map(([s]) => s)).toEqual(["10", "12"]);
    });

    it("turns arrivals into per-second samples, leaving out the second still filling", () => {
        const { source } = renderChain();
        act(() => {
            source().emit(checkpoint(1, 100, 5));
            source().emit(checkpoint(2, 101, 10));
            source().emit(checkpoint(3, 102, 1));
        });
        act(() => vi.advanceTimersByTime(16));
        // A five-second trailing mean: 5, then (5 + 10) / 2.
        expect(screen.getByLabelText("Samples")).toHaveTextContent(
            "100:5,101:7.5"
        );
    });

    it("starts over on a network switch", () => {
        const { source, switchTo } = renderChain();
        act(() => source().emit(checkpoint(10, 100)));
        act(() => vi.advanceTimersByTime(16));
        expect(screen.getByLabelText("Blocks")).toHaveTextContent("10");
        switchTo("testnet");
        expect(screen.getByLabelText("Blocks")).toHaveTextContent("");
        expect(source().url).toBe("/api/checkpoints/stream?dataset=testnet");
        expect(TestEventSource.instances[0].close).toHaveBeenCalled();
    });
});

function Feed() {
    const { transactions } = useTransactionStream();
    return (
        <output aria-label="Feed">
            {transactions.map((t) => t.digest).join(",")}
        </output>
    );
}

const transaction = (digest: string) => ({
    digest,
    sender: "0xa",
    isSystem: false,
    txnsCount: 1,
    gasIOTA: 1,
    timestampMs: "1000",
    checkpoint: "1",
});

describe("transaction stream", () => {
    it("folds arrivals in a quarter second at a time, newest first, once each", () => {
        render(
            <TestNetwork>
                <TransactionStreamProvider>
                    <Feed />
                </TransactionStreamProvider>
            </TestNetwork>
        );
        const source = TestEventSource.instances[0];
        expect(source.url).toBe("/api/transactions/stream?dataset=mainnet");
        act(() => {
            // The stream sends oldest first.
            for (const digest of ["a", "b", "c", "a"])
                source.emit(transaction(digest));
        });
        act(() => vi.advanceTimersByTime(200));
        expect(screen.getByLabelText("Feed")).toHaveTextContent("");
        act(() => vi.advanceTimersByTime(50));
        expect(screen.getByLabelText("Feed")).toHaveTextContent("c,b,a");
        act(() => source.emit(transaction("b")));
        act(() => vi.advanceTimersByTime(250));
        expect(screen.getByLabelText("Feed")).toHaveTextContent("c,b,a");
    });
});
