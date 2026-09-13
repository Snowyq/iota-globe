/** One in-flight poll per connection; cancellation also interrupts pending RPC calls. */
export function createSseStream<T>({
    signal,
    intervalMs,
    poll,
}: {
    signal: AbortSignal;
    intervalMs: number;
    poll: (emit: (item: T) => void, signal: AbortSignal) => Promise<void>;
}) {
    let cancel = () => {};
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            const pending = new AbortController();
            let closed = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const stop = (close: boolean) => {
                if (closed) return;
                closed = true;
                clearTimeout(timer);
                pending.abort();
                signal.removeEventListener("abort", onAbort);
                if (close) controller.close();
            };
            const onAbort = () => stop(true);
            cancel = () => stop(false);
            const emit = (item: T) => {
                if (!closed)
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(item)}\n\n`)
                    );
            };
            const tick = async () => {
                try {
                    await poll(
                        emit,
                        AbortSignal.any([
                            pending.signal,
                            AbortSignal.timeout(20_000),
                        ])
                    );
                } catch {
                    // A temporary RPC failure must not end the subscription.
                } finally {
                    if (!closed) timer = setTimeout(tick, intervalMs);
                }
            };
            signal.addEventListener("abort", onAbort, { once: true });
            if (signal.aborted) onAbort();
            else void tick();
        },
        cancel() {
            cancel();
        },
    });
}
