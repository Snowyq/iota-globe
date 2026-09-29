import type { NextRequest } from "next/server";

import { datasetFrom } from "./api";

type Listener<T> = (item: T) => void;
type Subscribe<T> = (
    network: string,
    url: string,
    listener: Listener<T>
) => () => void;

const HEARTBEAT_MS = 15_000;

/** Shared fan-out with a replay backlog. Runs while anyone is subscribed. */
export abstract class Hub<T> {
    private listeners = new Set<Listener<T>>();
    private backlog: T[] = [];

    constructor(
        private backlogSize: number,
        private name: string
    ) {}

    subscribe(listener: Listener<T>) {
        this.listeners.add(listener);
        for (const item of this.backlog) listener(item);
        if (this.listeners.size === 1) this.start();
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) this.stop();
        };
    }

    protected emit(item: T) {
        this.backlog.push(item);
        if (this.backlog.length > this.backlogSize) this.backlog.shift();
        // One broken subscriber must not stall the rest.
        for (const listener of this.listeners) {
            try {
                listener(item);
            } catch (error) {
                console.error(`${this.name} listener failed`, error);
            }
        }
    }

    protected abstract start(): void;
    protected abstract stop(): void;
}

/** One hub per network, kept on globalThis so dev reloads reuse it. */
export function perNetwork<H>(
    globalKey: string,
    create: (network: string, url: string) => H
) {
    const store = globalThis as unknown as Record<string, Map<string, H>>;
    const hubs = (store[globalKey] ??= new Map());
    return (network: string, url: string) => {
        let hub = hubs.get(network);
        if (!hub) {
            hub = create(network, url);
            hubs.set(network, hub);
        }
        return hub;
    };
}

export const sseEvent = (item: unknown) => `data: ${JSON.stringify(item)}\n\n`;

/** Bridges a hub subscription to one SSE response until the request ends. */
export function hubStream<T>(
    request: Request,
    subscribe: (listener: Listener<T>) => () => void
) {
    let dispose = () => {};
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            let closed = false;
            const send = (chunk: string) => {
                if (!closed) controller.enqueue(encoder.encode(chunk));
            };
            const unsubscribe = subscribe((item) => send(sseEvent(item)));
            // Comment lines keep idle proxies from dropping the connection.
            const heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);
            const onAbort = () => {
                dispose();
                try {
                    controller.close();
                } catch {
                    // already closed by the runtime
                }
            };
            dispose = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                unsubscribe();
                request.signal.removeEventListener("abort", onAbort);
            };
            request.signal.addEventListener("abort", onAbort, { once: true });
            if (request.signal.aborted) onAbort();
        },
        cancel() {
            dispose();
        },
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

/** GET handler streaming a per-network hub for `?dataset=`. */
export function hubRoute<T>(subscribe: Subscribe<T>) {
    return async function GET(request: NextRequest) {
        const dataset = datasetFrom(request);
        if (!dataset) return new Response("Invalid dataset", { status: 400 });
        return hubStream<T>(request, (listener) =>
            subscribe(dataset.name, dataset.url, listener)
        );
    };
}
