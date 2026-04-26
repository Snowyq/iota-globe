import { NETWORK_URLS as datasets } from "@/lib/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

export type TpsStreamItem = {
    currentTps: number;
    currentCheckpoint: string;
};

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!(datasetParam in datasets))
        return new Response("Invalid dataset", { status: 400 });

    const client = new IotaClient({ url: datasets[datasetParam] });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = (data: TpsStreamItem) =>
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );

            const load = async () => {
                try {
                    const m = await client.getNetworkMetrics();
                    send({ currentTps: m.currentTps, currentCheckpoint: m.currentCheckpoint });
                } catch {}
            };

            load();
            const interval = setInterval(load, 1_000);

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
