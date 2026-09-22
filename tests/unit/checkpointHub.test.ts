import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
    getLatestCheckpointSequenceNumber: vi.fn(),
    getCheckpoints: vi.fn(),
}));
const constructed = vi.hoisted(() => vi.fn());
vi.mock("@iota/iota-sdk/client", () => ({
    IotaClient: class {
        constructor(options: unknown) {
            constructed(options);
            return rpc;
        }
    },
}));

const checkpoint = (seq: number) => ({
    sequenceNumber: String(seq),
    timestampMs: String(1_000 + seq),
    epoch: "7",
    transactions: Array.from({ length: seq % 3 }, (_, i) => `tx${i}`),
});

async function load() {
    vi.resetModules();
    delete (globalThis as { __checkpointTails?: unknown }).__checkpointTails;
    return import("@/lib/checkpointHub");
}

describe("checkpoint tail", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        rpc.getLatestCheckpointSequenceNumber.mockReset();
        rpc.getCheckpoints.mockReset();
        constructed.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it("shares one tail per network, replays the backlog and resumes from the cursor", async () => {
        const { subscribeCheckpoints } = await load();
        rpc.getLatestCheckpointSequenceNumber.mockResolvedValue("1000");
        rpc.getCheckpoints
            .mockResolvedValueOnce({ data: [checkpoint(99), checkpoint(100)] })
            .mockRejectedValueOnce(new Error("rpc down"))
            .mockResolvedValueOnce({ data: [checkpoint(101)] })
            .mockResolvedValue({ data: [] });

        const first: string[] = [];
        const stopFirst = subscribeCheckpoints("mainnet", "http://rpc", (cp) =>
            first.push(cp.sequenceNumber)
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(first).toEqual(["99", "100"]);
        expect(rpc.getCheckpoints).toHaveBeenLastCalledWith(
            expect.objectContaining({ cursor: "700", descendingOrder: false })
        );

        const second: string[] = [];
        const stopSecond = subscribeCheckpoints("mainnet", "http://rpc", (cp) =>
            second.push(cp.sequenceNumber)
        );
        expect(second).toEqual(["99", "100"]);
        expect(constructed).toHaveBeenCalledTimes(1);

        // The failed read backs off, then continues after checkpoint 100.
        await vi.advanceTimersByTimeAsync(150);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(rpc.getCheckpoints).toHaveBeenLastCalledWith(
            expect.objectContaining({ cursor: "100" })
        );
        expect(first).toEqual(["99", "100", "101"]);
        expect(second).toEqual(["99", "100", "101"]);

        stopFirst();
        stopSecond();
        const calls = rpc.getCheckpoints.mock.calls.length;
        await vi.advanceTimersByTimeAsync(1_000);
        expect(rpc.getCheckpoints.mock.calls.length).toBe(calls);
    });
});
