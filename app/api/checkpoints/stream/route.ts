import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

import { NETWORK_URLS as datasets } from "@/lib/networks";

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
    if (!(datasetParam in datasets))
        return new Response("Invalid dataset", { status: 400 });

    const client = new IotaClient({
        url: datasets[datasetParam as keyof typeof datasets],
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (item: CheckpointStreamItem) =>
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(item)}\n\n`)
                );

            let lastSeq = -1;

            // Initial load: send last INITIAL_COUNT checkpoints oldest→newest
            try {
                const latest = Number(
                    await client.getLatestCheckpointSequenceNumber()
                );
                lastSeq = latest;
                const seqs = Array.from({ length: INITIAL_COUNT }, (_, i) =>
                    Math.max(0, latest - (INITIAL_COUNT - 1 - i))
                );
                const checkpoints = await Promise.all(
                    seqs.map((s) => client.getCheckpoint({ id: String(s) }))
                );
                for (const cp of checkpoints) {
                    send({
                        sequenceNumber: cp.sequenceNumber,
                        txCount: cp.transactions.length,
                        timestampMs: cp.timestampMs,
                        epoch: cp.epoch,
                    });
                }
            } catch {
                // best effort
            }

            // Polling for new checkpoints
            const poll = async () => {
                try {
                    const latest = Number(
                        await client.getLatestCheckpointSequenceNumber()
                    );
                    if (latest <= lastSeq) return;

                    const count = Math.min(latest - lastSeq, 20);
                    const newSeqs = Array.from(
                        { length: count },
                        (_, i) => lastSeq + 1 + i
                    );
                    const checkpoints = await Promise.all(
                        newSeqs.map((s) =>
                            client.getCheckpoint({ id: String(s) })
                        )
                    );
                    for (const cp of checkpoints) {
                        send({
                            sequenceNumber: cp.sequenceNumber,
                            txCount: cp.transactions.length,
                            timestampMs: cp.timestampMs,
                            epoch: cp.epoch,
                        });
                    }
                    lastSeq += count;
                } catch {
                    // best effort
                }
            };

            const interval = setInterval(poll, POLL_MS);
            request.signal.addEventListener("abort", () => {
                clearInterval(interval);
                controller.close();
            });
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
