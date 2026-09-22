import { type NextRequest } from "next/server";

import {
    subscribeCheckpoints,
    type CheckpointStreamItem,
} from "@/lib/checkpointHub";
import { hubStream } from "@/lib/hubStream";
import { NETWORK_URLS as datasets } from "@/lib/networks";

export type { CheckpointStreamItem };

// Pushes each checkpoint as soon as the shared tail reads it (~200 ms after
// it is certified), starting with the last minute already seen.
export async function GET(request: NextRequest) {
    const dataset = request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, dataset))
        return new Response("Invalid dataset", { status: 400 });
    return hubStream<CheckpointStreamItem>(request, (listener) =>
        subscribeCheckpoints(dataset, datasets[dataset], listener)
    );
}
