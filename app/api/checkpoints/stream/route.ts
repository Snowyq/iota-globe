import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

import { NETWORK_URLS as datasets } from "@/lib/networks";
import { createSseStream } from "@/lib/sse";

const INITIAL_COUNT = 8;
const POLL_MS = 2_000;

export type CheckpointStreamItem = {
    sequenceNumber: string;
    txCount: number;
    timestampMs: string;
    epoch: string;
};

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, datasetParam))
        return new Response("Invalid dataset", { status: 400 });

    const client = new IotaClient({
        url: datasets[datasetParam as keyof typeof datasets],
    });

    let lastSeq: number | null = null;
    const stream = createSseStream<CheckpointStreamItem>({
        signal: request.signal,
        intervalMs: POLL_MS,
        async poll(emit, signal) {
            const latest = Number(
                await client.getLatestCheckpointSequenceNumber({ signal })
            );
            if (signal.aborted || (lastSeq != null && latest <= lastSeq))
                return;
            const start =
                lastSeq == null
                    ? Math.max(0, latest - INITIAL_COUNT + 1)
                    : lastSeq + 1;
            const end = Math.min(latest, start + 19);
            const checkpoints = await Promise.all(
                Array.from({ length: end - start + 1 }, (_, i) =>
                    client.getCheckpoint({ id: String(start + i), signal })
                )
            );
            if (signal.aborted) return;
            for (const cp of checkpoints)
                emit({
                    sequenceNumber: cp.sequenceNumber,
                    txCount: cp.transactions.length,
                    timestampMs: cp.timestampMs,
                    epoch: cp.epoch,
                });
            lastSeq = end;
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
