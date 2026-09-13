import { NETWORK_URLS as datasets } from "@/lib/networks";
import { createSseStream } from "@/lib/sse";
import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

export type TpsStreamItem = {
    currentTps: number;
    currentCheckpoint: string;
};

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, datasetParam))
        return new Response("Invalid dataset", { status: 400 });

    const client = new IotaClient({ url: datasets[datasetParam] });
    const stream = createSseStream<TpsStreamItem>({
        signal: request.signal,
        intervalMs: 1_000,
        async poll(emit, signal) {
            const m = await client.getNetworkMetrics({ signal });
            emit({
                currentTps: m.currentTps,
                currentCheckpoint: m.currentCheckpoint,
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
