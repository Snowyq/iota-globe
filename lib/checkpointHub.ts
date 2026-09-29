import { IotaClient } from "@iota/iota-sdk/client";

import { withTimeout } from "./utils";
import { Hub, perNetwork } from "./hubStream";

export type CheckpointStreamItem = {
    sequenceNumber: string;
    txCount: number;
    timestampMs: string;
    epoch: string;
};

/** Streamed fields plus the tx digests, which feed the transaction hub. */
export type CheckpointRecord = CheckpointStreamItem & { digests: string[] };

// ~200 ms per checkpoint and no RPC subscription, so we poll pages.
const TICK_MS = 150;
const IDLE_BACKOFF_MS = 2_000;
const PAGE_LIMIT = 100;
// About a minute of chain, enough to draw the throughput trace right away.
const BACKLOG = 300;

class CheckpointTail extends Hub<CheckpointRecord> {
    private cursor: number | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private controller: AbortController | null = null;
    private failures = 0;

    constructor(private client: IotaClient) {
        super(BACKLOG, "Checkpoint");
    }

    protected start() {
        this.controller = new AbortController();
        void this.tick();
    }

    protected stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.controller?.abort();
        this.controller = null;
    }

    private async tick() {
        const controller = this.controller;
        if (!controller) return;
        try {
            await this.readPage(controller);
            this.failures = 0;
        } catch {
            // The cursor is kept, so the next tick resumes from it.
            this.failures += 1;
        } finally {
            if (this.controller === controller && !controller.signal.aborted) {
                const delay = this.failures
                    ? Math.min(IDLE_BACKOFF_MS * this.failures, 10_000)
                    : TICK_MS;
                this.timer = setTimeout(() => void this.tick(), delay);
            }
        }
    }

    private async readPage(controller: AbortController) {
        const signal = withTimeout(controller.signal, 10_000);
        if (this.cursor == null) {
            const latest = Number(
                await this.client.getLatestCheckpointSequenceNumber({ signal })
            );
            this.cursor = Math.max(-1, latest - BACKLOG);
        }
        const page = await this.client.getCheckpoints({
            cursor: this.cursor < 0 ? null : String(this.cursor),
            limit: PAGE_LIMIT,
            descendingOrder: false,
            signal,
        });
        if (controller.signal.aborted) return;
        for (const cp of page.data) {
            this.cursor = Number(cp.sequenceNumber);
            this.emit({
                sequenceNumber: cp.sequenceNumber,
                txCount: cp.transactions.length,
                timestampMs: cp.timestampMs,
                epoch: cp.epoch,
                digests: cp.transactions,
            });
        }
    }
}

const tailFor = perNetwork(
    "__checkpointTails",
    (_network, url) => new CheckpointTail(new IotaClient({ url }))
);

/** Full records, digests included. Server only. */
export function subscribeCheckpointRecords(
    network: string,
    url: string,
    listener: (record: CheckpointRecord) => void
) {
    return tailFor(network, url).subscribe(listener);
}

/** What a browser receives for each checkpoint. */
export function subscribeCheckpoints(
    network: string,
    url: string,
    listener: (item: CheckpointStreamItem) => void
) {
    return tailFor(network, url).subscribe(
        ({ sequenceNumber, txCount, timestampMs, epoch }) =>
            listener({ sequenceNumber, txCount, timestampMs, epoch })
    );
}
