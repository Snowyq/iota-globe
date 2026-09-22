import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
    getLatestCheckpointSequenceNumber: vi.fn(),
    getCheckpoints: vi.fn(),
    multiGetTransactionBlocks: vi.fn(),
}));
vi.mock("@iota/iota-sdk/client", () => ({
    IotaClient: class {
        constructor() {
            return rpc;
        }
    },
}));

const checkpoint = (seq: number, digests: string[]) => ({
    sequenceNumber: String(seq),
    timestampMs: String(1_000 + seq),
    epoch: "7",
    transactions: digests,
});
const tx = (digest: string, sender = "0xabc") => ({
    digest,
    transaction: {
        data: {
            sender,
            transaction: {
                kind: "ProgrammableTransaction",
                transactions: [1, 2],
            },
        },
    },
    effects: {
        gasUsed: {
            computationCost: "1000000",
            storageCost: "2000000",
            storageRebate: "1000000",
        },
    },
});

async function load() {
    vi.resetModules();
    const hub = globalThis as Record<string, unknown>;
    delete hub.__checkpointTails;
    delete hub.__transactionTails;
    return import("@/lib/transactionHub");
}

describe("transaction tail", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        for (const fn of Object.values(rpc)) fn.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it("resolves every checkpoint's digests in one shared batch, oldest first", async () => {
        const { subscribeTransactions } = await load();
        rpc.getLatestCheckpointSequenceNumber.mockResolvedValue("10");
        rpc.getCheckpoints
            .mockResolvedValueOnce({
                data: [checkpoint(9, ["a", "b"]), checkpoint(10, ["c"])],
            })
            .mockResolvedValue({ data: [] });
        rpc.multiGetTransactionBlocks.mockImplementation(
            async ({ digests }: { digests: string[] }) =>
                digests.map((d) => tx(d))
        );

        const first: string[] = [];
        const second: string[] = [];
        const stopFirst = subscribeTransactions("mainnet", "http://rpc", (t) =>
            first.push(t.digest)
        );
        await vi.advanceTimersByTimeAsync(0);
        const stopSecond = subscribeTransactions("mainnet", "http://rpc", (t) =>
            second.push(t.digest)
        );
        await vi.advanceTimersByTimeAsync(0);

        expect(rpc.multiGetTransactionBlocks).toHaveBeenCalledTimes(1);
        expect(first).toEqual(["a", "b", "c"]);
        // A late subscriber starts from the backlog.
        expect(second).toEqual(["a", "b", "c"]);

        stopFirst();
        stopSecond();
        const calls = rpc.getCheckpoints.mock.calls.length;
        await vi.advanceTimersByTimeAsync(1_000);
        expect(rpc.getCheckpoints.mock.calls.length).toBe(calls);
    });

    it("maps fees and marks system transactions", async () => {
        const { toStreamItem } = await load();
        const item = toStreamItem(tx("d") as never, {
            digest: "d",
            checkpoint: "5",
            timestampMs: "99",
        });
        expect(item).toMatchObject({
            digest: "d",
            isSystem: false,
            txnsCount: 2,
            gasIOTA: 0.002,
            checkpoint: "5",
            timestampMs: "99",
        });
        expect(
            toStreamItem(tx("s", "0x" + "0".repeat(64)) as never).isSystem
        ).toBe(true);
    });
});
