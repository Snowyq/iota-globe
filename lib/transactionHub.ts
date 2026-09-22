import { IotaClient } from "@iota/iota-sdk/client";
import type { IotaTransactionBlockResponse } from "@iota/iota-sdk/client";

import { subscribeCheckpointRecords } from "./checkpointHub";

export type TransactionStreamItem = {
    digest: string;
    sender: string;
    isSystem: boolean;
    txnsCount: number | null;
    gasIOTA: number;
    timestampMs: string | null;
    checkpoint: string | null;
};

type Listener = (item: TransactionStreamItem) => void;
type Pending = { digest: string; checkpoint: string; timestampMs: string };

const SYSTEM_ADDRESS =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
// The RPC resolves at most 50 digests per call. A feed shows the newest
// rows, so when the chain outruns one call the oldest digests are dropped.
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

// Rides the shared checkpoint tail: every certified checkpoint hands over
// its digests, which are resolved in one batched call per round. Nothing
// polls on its own and every open stream shares the same reads.
class TransactionTail {
    private listeners = new Set<Listener>();
    private backlog: TransactionStreamItem[] = [];
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
    ) {}

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        for (const item of this.backlog) listener(item);
        if (this.listeners.size === 1) this.start();
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) this.stop();
        };
    }

    private start() {
        this.controller = new AbortController();
        this.stopCheckpoints = subscribeCheckpointRecords(
            this.network,
            this.url,
            (record) => {
                for (const digest of record.digests)
                    if (!this.seen.has(digest))
                        this.queue.push({
                            digest,
                            checkpoint: record.sequenceNumber,
                            timestampMs: record.timestampMs,
                        });
                if (this.queue.length > BATCH * 4)
                    this.queue = this.queue.slice(-BATCH * 4);
                // A page of checkpoints arrives in one go; resolve all of
                // its digests in one call rather than one per checkpoint.
                if (!this.scheduled) {
                    this.scheduled = true;
                    queueMicrotask(() => {
                        this.scheduled = false;
                        void this.pump();
                    });
                }
            }
        );
    }

    private stop() {
        this.stopCheckpoints?.();
        this.stopCheckpoints = null;
        this.controller?.abort();
        this.controller = null;
        this.queue = [];
        this.inflight = false;
    }

    private async pump() {
        const controller = this.controller;
        if (this.inflight || !controller || !this.queue.length) return;
        this.inflight = true;
        const batch = this.queue.slice(-BATCH);
        this.queue = [];
        try {
            const byDigest = new Map(batch.map((p) => [p.digest, p]));
            const txs = await this.client.multiGetTransactionBlocks({
                digests: batch.map((p) => p.digest),
                options: { showEffects: true, showInput: true },
                signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(10_000),
                ]),
            });
            if (controller.signal.aborted) return;
            const items = txs
                .filter((tx) => tx.digest && !this.seen.has(tx.digest))
                .map((tx) => toStreamItem(tx, byDigest.get(tx.digest)))
                // Oldest first, so the newest lands on top of a feed.
                .sort(
                    (a, b) =>
                        Number(a.checkpoint ?? 0) - Number(b.checkpoint ?? 0)
                );
            for (const item of items) {
                this.seen.add(item.digest);
                if (this.seen.size > SEEN)
                    this.seen.delete(this.seen.values().next().value!);
                this.backlog.push(item);
                if (this.backlog.length > BACKLOG) this.backlog.shift();
                for (const listener of this.listeners) {
                    try {
                        listener(item);
                    } catch (error) {
                        console.error("Transaction listener failed", error);
                    }
                }
            }
            this.failures = 0;
        } catch {
            if (controller.signal.aborted) return;
            // Lost digests are not retried; the feed continues with the next
            // checkpoints. Back off briefly so a failing RPC is not hammered.
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
}

const globalHub = globalThis as typeof globalThis & {
    __transactionTails?: Map<string, TransactionTail>;
};
const tails: Map<string, TransactionTail> = (globalHub.__transactionTails ??=
    new Map());

export function subscribeTransactions(
    network: string,
    url: string,
    listener: Listener
) {
    let tail = tails.get(network);
    if (!tail) {
        tail = new TransactionTail(new IotaClient({ url }), network, url);
        tails.set(network, tail);
    }
    return tail.subscribe(listener);
}
