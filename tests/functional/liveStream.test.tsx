import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveStream } from "@/hooks/useLiveStream";
import { TestNetwork } from "../helpers/providers";
import { installEventSource, TestEventSource } from "../helpers/eventSource";

const PATH = "/api/checkpoints/stream";

beforeEach(() => {
    installEventSource();
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
});

function Status({ onValue }: { onValue: (value: unknown) => void }) {
    const status = useLiveStream(PATH, onValue);
    return <output aria-label="Stream status">{status}</output>;
}

function Consumer({
    network = "mainnet",
    onValue = vi.fn(),
}: {
    network?: "mainnet" | "testnet";
    onValue?: (value: unknown) => void;
}) {
    return (
        <TestNetwork network={network}>
            <Status onValue={onValue} />
        </TestNetwork>
    );
}

const status = () => screen.getByLabelText("Stream status");

describe("useLiveStream", () => {
    it("goes live on the first message, not on open", () => {
        const onValue = vi.fn();
        render(<Consumer onValue={onValue} />);
        const source = TestEventSource.instances[0];
        expect(source.url).toBe(`${PATH}?dataset=mainnet`);
        act(() => source.open());
        expect(status()).toHaveTextContent("connecting");
        act(() => source.emit({ currentTps: 12 }));
        expect(onValue).toHaveBeenCalledWith({ currentTps: 12 });
        expect(status()).toHaveTextContent("live");
    });

    it("uses the latest callback without reconnecting", () => {
        const first = vi.fn(),
            latest = vi.fn();
        const { rerender } = render(<Consumer onValue={first} />);
        rerender(<Consumer onValue={latest} />);
        act(() => TestEventSource.instances[0].emit(5));
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledWith(5);
        expect(TestEventSource.instances).toHaveLength(1);
    });

    it("reports waiting and reconnecting states", () => {
        render(<Consumer />);
        const source = TestEventSource.instances[0];
        act(() => {
            source.open();
            source.emit(10);
            vi.advanceTimersByTime(20_000);
        });
        expect(status()).toHaveTextContent("waiting");
        act(() => source.emit(20));
        expect(status()).toHaveTextContent("live");
        act(() => source.fail());
        expect(status()).toHaveTextContent("reconnecting");
    });

    it("ignores malformed payloads", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const onValue = vi.fn();
        render(<Consumer onValue={onValue} />);
        act(() => TestEventSource.instances[0].emitRaw("{invalid"));
        expect(onValue).not.toHaveBeenCalled();
        expect(status()).toHaveTextContent("connecting");
    });

    it("reconnects on network change and closes on unmount", () => {
        const { rerender, unmount } = render(<Consumer />);
        const old = TestEventSource.instances[0];
        act(() => old.emit(10));
        rerender(<Consumer network="testnet" />);
        expect(old.close).toHaveBeenCalledOnce();
        expect(TestEventSource.instances[1].url).toContain("dataset=testnet");
        expect(status()).toHaveTextContent("connecting");
        unmount();
        expect(TestEventSource.instances[1].close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("ignores events queued on a closed stream", () => {
        const onValue = vi.fn();
        const { rerender } = render(<Consumer onValue={onValue} />);
        const old = TestEventSource.instances[0];
        const queuedMessage = old.onmessage!;
        const queuedError = old.onerror!;
        rerender(<Consumer network="testnet" onValue={onValue} />);
        act(() => {
            queuedMessage(
                new MessageEvent("message", { data: JSON.stringify(999) })
            );
            queuedError();
        });
        expect(onValue).not.toHaveBeenCalled();
        expect(status()).toHaveTextContent("connecting");
        act(() => TestEventSource.instances[1].emit(12));
        expect(onValue).toHaveBeenCalledExactlyOnceWith(12);
        expect(status()).toHaveTextContent("live");
    });
});
