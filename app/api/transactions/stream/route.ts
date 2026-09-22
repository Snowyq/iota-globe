import { type NextRequest } from "next/server";

import { hubStream } from "@/lib/hubStream";
import { NETWORK_URLS as datasets } from "@/lib/networks";
import {
    subscribeTransactions,
    type TransactionStreamItem,
} from "@/lib/transactionHub";

export type { TransactionStreamItem };

// Every transaction of every checkpoint, resolved in batches off the shared
// checkpoint tail and pushed as soon as it is read.
export async function GET(request: NextRequest) {
    const dataset = request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(datasets, dataset))
        return new Response("Invalid dataset", { status: 400 });
    return hubStream<TransactionStreamItem>(request, (listener) =>
        subscribeTransactions(dataset, datasets[dataset], listener)
    );
}
