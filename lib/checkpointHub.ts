import { IotaClient } from "@iota/iota-sdk/client";

export type CheckpointStreamItem = {
    sequenceNumber: string;
    txCount: number;
    timestampMs: string;
    epoch: string;
};

type Listener = (item: CheckpointStreamItem) => void;

// IOTA certifies a checkpoint roughly every 200 ms and the JSON-RPC API has
// no checkpoint subscription, so the hub tails the chain with one paginated
// read per tick. One tail per network is shared by every open stream.
const TICK_MS = 150;
const IDLE_BACKOFF_MS = 2_000;
const PAGE_LIMIT = 50;
const BACKLOG = 28;

class CheckpointTail {
    private listeners = new Set<Listener>();
    private backlog: CheckpointStreamItem[] = [];
    private cursor: number | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private controller: AbortController | null = null;
    private failures = 0;

    constructor(private client: IotaClient) {}

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
        void this.tick();
    }

    private stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.controller?.abort();
        this.controller = null;
    }

    private async tick() {
        const controller = this.controller;
        if (!controller) return;
        const signal = AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10_000),
        ]);
        try {
            if (this.cursor == null) {
                const latest = Number(
                    await this.client.getLatestCheckpointSequenceNumber({
                        signal,
                    })
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
                const item: CheckpointStreamItem = {
                    sequenceNumber: cp.sequenceNumber,
                    txCount: cp.transactions.length,
                    timestampMs: cp.timestampMs,
                    epoch: cp.epoch,
                };
                this.cursor = Number(cp.sequenceNumber);
                this.backlog = [...this.backlog, item].slice(-BACKLOG);
                for (const listener of this.listeners) listener(item);
            }
            this.failures = 0;
        } catch {
            // A failed read keeps the cursor; the next tick resumes from it.
            this.failures += 1;
        } finally {
            if (this.controller === controller && !controller.signal.aborted) {
                // Back off while the RPC is failing, tail tightly otherwise.
                const delay = this.failures
                    ? Math.min(IDLE_BACKOFF_MS * this.failures, 10_000)
                    : TICK_MS;
                this.timer = setTimeout(() => void this.tick(), delay);
            }
        }
    }
}

// Survive module reloads in development so one tail exists per network.
const globalHub = globalThis as typeof globalThis & {
    __checkpointTails?: Map<string, CheckpointTail>;
};
const tails = (globalHub.__checkpointTails ??= new Map());

export function subscribeCheckpoints(
    network: string,
    url: string,
    listener: Listener
) {
    let tail = tails.get(network);
    if (!tail) {
        tail = new CheckpointTail(new IotaClient({ url }));
        tails.set(network, tail);
    }
    return tail.subscribe(listener);
}
