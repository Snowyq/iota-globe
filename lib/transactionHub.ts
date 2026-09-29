import { IotaClient } from "@iota/iota-sdk/client";
import type { IotaTransactionBlockResponse } from "@iota/iota-sdk/client";

import {
    subscribeCheckpointRecords,
    type CheckpointRecord,
} from "./checkpointHub";
import { Hub, perNetwork } from "./hubStream";
import { withTimeout } from "./utils";

export type TransactionStreamItem = {
    digest: string;
    sender: string;
    isSystem: boolean;
    txnsCount: number | null;
    gasIOTA: number;
    timestampMs: string | null;
    checkpoint: string | null;
};

type Pending = { digest: string; checkpoint: string; timestampMs: string };

const SYSTEM_ADDRESS =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
// RPC limit per call. If the chain outruns it, the oldest digests are dropped.
const BATCH = 50;
const BACKLOG = 40;
const SEEN = 4_000;

export function toStreamItem(
    tx: IotaTransactionBlockResponse,
    pending?: Pending
): TransactionStreamItem {
    const sender = tx.transaction?.data.sender ?? SYSTEM_ADDRESS;
    const kind = tx.transaction?.data.transaction;
    const gas = tx.effects?.gasUsed;
    return {
        digest: tx.digest,
        sender,
        isSystem: sender === SYSTEM_ADDRESS,
        txnsCount:
            kind?.kind === "ProgrammableTransaction"
                ? kind.transactions.length
                : null,
        gasIOTA: gas
            ? Math.max(
                  0,
                  (Number(gas.computationCost) +
                      Number(gas.storageCost) -
                      Number(gas.storageRebate)) /
                      1e9
              )
            : 0,
        timestampMs: tx.timestampMs ?? pending?.timestampMs ?? null,
        checkpoint: tx.checkpoint ?? pending?.checkpoint ?? null,
    };
}

// Rides the shared checkpoint tail and resolves its digests in batches.
class TransactionTail extends Hub<TransactionStreamItem> {
    private queue: Pending[] = [];
    private seen = new Set<string>();
    private inflight = false;
    private scheduled = false;
    private stopCheckpoints: (() => void) | null = null;
    private controller: AbortController | null = null;
    private failures = 0;

    constructor(
        private client: IotaClient,
        private network: string,
        private url: string
    ) {
        super(BACKLOG, "Transaction");
    }

    protected start() {
        this.controller = new AbortController();
        this.stopCheckpoints = subscribeCheckpointRecords(
            this.network,
            this.url,
            (record) => this.enqueue(record)
        );
    }

    protected stop() {
        this.stopCheckpoints?.();
        this.stopCheckpoints = null;
        this.controller?.abort();
        this.controller = null;
        this.queue = [];
        this.inflight = false;
    }

    private enqueue(record: CheckpointRecord) {
        for (const digest of record.digests)
            if (!this.seen.has(digest))
                this.queue.push({
                    digest,
                    checkpoint: record.sequenceNumber,
                    timestampMs: record.timestampMs,
                });
        if (this.queue.length > BATCH * 4)
            this.queue = this.queue.slice(-BATCH * 4);
        // A page of checkpoints arrives at once; resolve it in one call.
        if (!this.scheduled) {
            this.scheduled = true;
            queueMicrotask(() => {
                this.scheduled = false;
                void this.pump();
            });
        }
    }

    private async pump() {
        const controller = this.controller;
        if (this.inflight || !controller || !this.queue.length) return;
        this.inflight = true;
        const batch = this.queue.slice(-BATCH);
        this.queue = [];
        try {
            const items = await this.resolve(batch, controller.signal);
            if (controller.signal.aborted) return;
            for (const item of items) {
                this.seen.add(item.digest);
                if (this.seen.size > SEEN)
                    this.seen.delete(this.seen.values().next().value!);
                this.emit(item);
            }
            this.failures = 0;
        } catch {
            if (controller.signal.aborted) return;
            // Lost digests are dropped; back off while the RPC fails.
            this.failures += 1;
            await new Promise((r) =>
                setTimeout(r, Math.min(500 * this.failures, 5_000))
            );
        } finally {
            if (this.controller === controller) {
                this.inflight = false;
                if (this.queue.length) void this.pump();
            }
        }
    }

    private async resolve(batch: Pending[], signal: AbortSignal) {
        const byDigest = new Map(batch.map((p) => [p.digest, p]));
        const txs = await this.client.multiGetTransactionBlocks({
            digests: batch.map((p) => p.digest),
            options: { showEffects: true, showInput: true },
            signal: withTimeout(signal, 10_000),
        });
        return (
            txs
                .filter((tx) => tx.digest && !this.seen.has(tx.digest))
                .map((tx) => toStreamItem(tx, byDigest.get(tx.digest)))
                // Oldest first, so the newest lands on top of a feed.
                .sort(
                    (a, b) =>
                        Number(a.checkpoint ?? 0) - Number(b.checkpoint ?? 0)
                )
        );
    }
}

const tailFor = perNetwork(
    "__transactionTails",
    (network, url) => new TransactionTail(new IotaClient({ url }), network, url)
);

export function subscribeTransactions(
    network: string,
    url: string,
    listener: (item: TransactionStreamItem) => void
) {
    return tailFor(network, url).subscribe(listener);
}
