import { NETWORK_URLS as datasets } from "@/lib/networks";
import { createSseStream } from "@/lib/sse";
import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

const SYSTEM_ADDRESS =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLL_MS = 2_000;

export type TransactionStreamItem = {
    digest: string;
    sender: string;
    isSystem: boolean;
    txnsCount: number | null;
    gasIOTA: number;
    timestampMs: string | null;
    checkpoint: string | null;
};

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, datasetParam))
        return new Response("Invalid dataset", { status: 400 });

    const client = new IotaClient({ url: datasets[datasetParam] });
    const seen = new Set<string>();
    let lastSeq: number | null = null;
    const stream = createSseStream<TransactionStreamItem>({
        signal: request.signal,
        intervalMs: POLL_MS,
        async poll(emit, signal) {
            const sendCheckpoint = async (seq: number) => {
                const cp = await client.getCheckpoint({
                    id: String(seq),
                    signal,
                });
                if (signal.aborted) return;
                const newDigests = (cp.transactions ?? [])
                    .filter((d) => !seen.has(d))
                    .slice(0, 20);
                if (!newDigests.length) return;

                const txs = await client.multiGetTransactionBlocks({
                    digests: newDigests,
                    options: { showEffects: true, showInput: true },
                    signal,
                });
                if (signal.aborted) return;

                for (const tx of txs) {
                    if (!tx.digest || seen.has(tx.digest)) continue;
                    seen.add(tx.digest);
                    if (seen.size > 2_000)
                        seen.delete(seen.values().next().value!);

                    const sender =
                        tx.transaction?.data.sender ?? SYSTEM_ADDRESS;
                    const kind = tx.transaction?.data.transaction;
                    const gas = tx.effects?.gasUsed;

                    emit({
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
                        timestampMs: tx.timestampMs ?? cp.timestampMs,
                        checkpoint: tx.checkpoint ?? String(seq),
                    });
                }
            };

            const latest = Number(
                await client.getLatestCheckpointSequenceNumber({ signal })
            );
            if (signal.aborted || (lastSeq != null && latest <= lastSeq))
                return;
            if (lastSeq == null && latest > 0) await sendCheckpoint(latest - 1);
            if (signal.aborted) return;
            await sendCheckpoint(latest);
            lastSeq = latest;
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
