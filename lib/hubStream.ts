const HEARTBEAT_MS = 15_000;

// Bridges a shared hub subscription to one SSE response: each item is sent
// the moment the hub emits it, comment lines keep idle proxies from closing
// the connection, and the subscription ends with the request.
export function hubStream<T>(
    request: Request,
    subscribe: (listener: (item: T) => void) => () => void
) {
    let dispose = () => {};
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            let closed = false;
            const send = (chunk: string) => {
                if (!closed) controller.enqueue(encoder.encode(chunk));
            };
            const unsubscribe = subscribe((item) =>
                send(`data: ${JSON.stringify(item)}\n\n`)
            );
            const heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);
            const onAbort = () => {
                dispose();
                try {
                    controller.close();
                } catch {
                    // Already closed by the runtime.
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
