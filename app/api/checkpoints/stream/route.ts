import { type NextRequest } from "next/server";

import {
    subscribeCheckpoints,
    type CheckpointStreamItem,
} from "@/lib/checkpointHub";
import { NETWORK_URLS as datasets } from "@/lib/networks";

export type { CheckpointStreamItem };

const HEARTBEAT_MS = 15_000;

// Pushes each checkpoint as soon as the shared tail reads it (~200 ms after
// it is certified), starting with the most recent ones already seen.
export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, datasetParam))
        return new Response("Invalid dataset", { status: 400 });

    let dispose = () => {};
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            let closed = false;
            const send = (chunk: string) => {
                if (!closed) controller.enqueue(encoder.encode(chunk));
            };
            const unsubscribe = subscribeCheckpoints(
                datasetParam,
                datasets[datasetParam],
                (item) => send(`data: ${JSON.stringify(item)}\n\n`)
            );
            // Comment lines keep proxies from closing a quiet connection.
            const heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);
            dispose = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                unsubscribe();
                request.signal.removeEventListener("abort", onAbort);
            };
            const onAbort = () => {
                dispose();
                try {
                    controller.close();
                } catch {
                    // Already closed by the runtime.
                }
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
