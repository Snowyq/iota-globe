import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveStream } from "@/hooks/useLiveStream";
import { TestNetwork } from "../helpers/providers";
import { installEventSource, TestEventSource } from "../helpers/eventSource";

beforeEach(() => {
    installEventSource();
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
});
// Provider props are rerendered with the consumer, so dataset changes exercise cleanup.
function Consumer({
    network,
    path,
    onValue,
}: {
    network: "mainnet" | "testnet";
    path: string | null;
    onValue: (value: unknown) => void;
}) {
    return (
        <TestNetwork network={network}>
            <Status path={path} onValue={onValue} />
        </TestNetwork>
    );
}
function Status({
    path,
    onValue,
}: {
    path: string | null;
    onValue: (value: unknown) => void;
}) {
    const status = useLiveStream(path, onValue);
    return <output aria-label="Stream status">{status}</output>;
}

describe("live stream lifecycle", () => {
    it("does not open a connection for an inactive tab", () => {
        render(<Consumer network="mainnet" path={null} onValue={vi.fn()} />);
        expect(TestEventSource.instances).toHaveLength(0);
    });
    it("becomes live only after a decoded message, not merely an open socket", () => {
        const callback = vi.fn();
        render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={callback}
            />
        );
        const source = TestEventSource.instances[0];
        expect(source.url).toBe("/api/tps/stream?dataset=mainnet");
        act(() => source.open());
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "connecting"
        );
        act(() => source.emit({ currentTps: 12 }));
        expect(callback).toHaveBeenCalledWith({ currentTps: 12 });
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "live"
        );
    });
    it("uses the latest callback without reconnecting on every render", () => {
        const first = vi.fn(),
            latest = vi.fn();
        const { rerender } = render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={first}
            />
        );
        rerender(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={latest}
            />
        );
        act(() => TestEventSource.instances[0].emit(5));
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledWith(5);
        expect(TestEventSource.instances).toHaveLength(1);
    });
    it("marks an open but silent connection as waiting and recovers on data", () => {
        render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={vi.fn()}
            />
        );
        const source = TestEventSource.instances[0];
        act(() => {
            source.open();
            source.emit(10);
            vi.advanceTimersByTime(20_000);
        });
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "waiting"
        );
        act(() => source.emit(20));
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "live"
        );
    });
    it("reports reconnection after transport errors", () => {
        render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={vi.fn()}
            />
        );
        act(() => TestEventSource.instances[0].fail());
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "reconnecting"
        );
    });
    it("ignores malformed payloads without marking the stream live", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const onValue = vi.fn();
        render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={onValue}
            />
        );
        act(() => TestEventSource.instances[0].emitRaw("{invalid"));
        expect(onValue).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "connecting"
        );
    });
    it("closes the old dataset connection and resets status on network changes", () => {
        const onValue = vi.fn();
        const { rerender, unmount } = render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={onValue}
            />
        );
        const old = TestEventSource.instances[0];
        act(() => old.emit(10));
        rerender(
            <Consumer
                network="testnet"
                path="/api/tps/stream"
                onValue={onValue}
            />
        );
        expect(old.close).toHaveBeenCalledOnce();
        expect(TestEventSource.instances[1].url).toContain("dataset=testnet");
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "connecting"
        );
        unmount();
        expect(TestEventSource.instances[1].close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
    it("ignores queued messages and errors from a disposed network stream", () => {
        const onValue = vi.fn();
        const { rerender } = render(
            <Consumer
                network="mainnet"
                path="/api/tps/stream"
                onValue={onValue}
            />
        );
        const old = TestEventSource.instances[0];
        const queuedMessage = old.onmessage!;
        const queuedError = old.onerror!;
        rerender(
            <Consumer
                network="testnet"
                path="/api/tps/stream"
                onValue={onValue}
            />
        );
        act(() => {
            queuedMessage(
                new MessageEvent("message", { data: JSON.stringify(999) })
            );
            queuedError();
        });
        expect(onValue).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "connecting"
        );
        act(() => TestEventSource.instances[1].emit(12));
        expect(onValue).toHaveBeenCalledExactlyOnceWith(12);
        expect(screen.getByLabelText("Stream status")).toHaveTextContent(
            "live"
        );
    });
});
