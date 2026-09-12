import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSseStream } from "@/lib/sse";
import { deferred } from "../helpers/async";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("server SSE polling lifecycle", () => {
    it("encodes JSON as an SSE event", async () => {
        const connection = new AbortController();
        const stream = createSseStream({
            signal: connection.signal,
            intervalMs: 1000,
            poll: async (emit) => {
                emit({ tps: 12 });
            },
        });
        const reader = stream.getReader();
        const result = await reader.read();
        expect(new TextDecoder().decode(result.value)).toBe(
            'data: {"tps":12}\n\n'
        );
        connection.abort();
        expect(await reader.read()).toEqual({ value: undefined, done: true });
        expect(vi.getTimerCount()).toBe(0);
    });
    it("waits for a slow poll to finish before scheduling another", async () => {
        const response = deferred<void>();
        const connection = new AbortController();
        const poll = vi
            .fn()
            .mockReturnValueOnce(response.promise)
            .mockResolvedValue(undefined);
        createSseStream({ signal: connection.signal, intervalMs: 1000, poll });
        await vi.advanceTimersByTimeAsync(5000);
        expect(poll).toHaveBeenCalledOnce();
        response.resolve();
        await vi.advanceTimersByTimeAsync(1000);
        expect(poll).toHaveBeenCalledTimes(2);
        connection.abort();
        expect(vi.getTimerCount()).toBe(0);
    });
    it("closes immediately when disconnected during the initial request and ignores its late output", async () => {
        const response = deferred<void>();
        const connection = new AbortController();
        let pendingSignal: AbortSignal | undefined;
        const poll = vi.fn(
            async (emit: (value: number) => void, signal: AbortSignal) => {
                pendingSignal = signal;
                await response.promise;
                emit(999);
            }
        );
        const reader = createSseStream({
            signal: connection.signal,
            intervalMs: 1000,
            poll,
        }).getReader();
        connection.abort();
        expect(pendingSignal?.aborted).toBe(true);
        expect(await reader.read()).toEqual({ value: undefined, done: true });
        response.resolve();
        await vi.advanceTimersByTimeAsync(5000);
        expect(poll).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
    it("also stops and aborts RPC work when the response reader is cancelled", async () => {
        const connection = new AbortController();
        const response = deferred<void>();
        let pendingSignal: AbortSignal | undefined;
        const poll = vi.fn(
            async (_emit: (value: unknown) => void, signal: AbortSignal) => {
                pendingSignal = signal;
                await response.promise;
            }
        );
        const reader = createSseStream({
            signal: connection.signal,
            intervalMs: 1000,
            poll,
        }).getReader();
        await reader.cancel();
        expect(connection.signal.aborted).toBe(false);
        expect(pendingSignal?.aborted).toBe(true);
        response.resolve();
        await vi.advanceTimersByTimeAsync(5000);
        expect(poll).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
    it("does not start work for an already aborted request", async () => {
        const connection = new AbortController();
        connection.abort();
        const poll = vi.fn();
        const reader = createSseStream({
            signal: connection.signal,
            intervalMs: 1000,
            poll,
        }).getReader();
        expect(await reader.read()).toEqual({ value: undefined, done: true });
        expect(poll).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
    it("retries a temporary RPC error without terminating the stream", async () => {
        const connection = new AbortController();
        const poll = vi
            .fn()
            .mockRejectedValueOnce(new Error("RPC unavailable"))
            .mockImplementation(async (emit) => {
                emit(12);
            });
        const reader = createSseStream({
            signal: connection.signal,
            intervalMs: 1000,
            poll,
        }).getReader();
        await vi.advanceTimersByTimeAsync(1000);
        expect(poll).toHaveBeenCalledTimes(2);
        expect(new TextDecoder().decode((await reader.read()).value)).toBe(
            "data: 12\n\n"
        );
        connection.abort();
    });
    it("gives each poll a deadline and recovers after it expires", async () => {
        const connection = new AbortController();
        const timeout = new AbortController();
        vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(timeout.signal);
        const poll = vi.fn(
            (_emit: (value: unknown) => void, signal: AbortSignal) =>
                new Promise<void>((resolve, reject) => {
                    if (poll.mock.calls.length > 1) resolve();
                    else
                        signal.addEventListener(
                            "abort",
                            () => reject(new Error("Timed out")),
                            { once: true }
                        );
                })
        );
        createSseStream({ signal: connection.signal, intervalMs: 1000, poll });
        expect(AbortSignal.timeout).toHaveBeenCalledWith(20_000);
        timeout.abort();
        await vi.advanceTimersByTimeAsync(1000);
        expect(poll).toHaveBeenCalledTimes(2);
        expect(poll.mock.calls[0][1].aborted).toBe(true);
        expect(poll.mock.calls[1][1].aborted).toBe(false);
        connection.abort();
    });
});
