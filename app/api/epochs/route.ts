import { NETWORK_URLS as datasets } from "@/lib/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { unstable_cache } from "next/cache";
import { type NextRequest } from "next/server";

const PAGE_SIZE = 20;

export type EpochRow = {
    epoch: string;
    totalTransactions: string;
    stakeRewardsNano: string | null;
    lastCheckpointId: string | null;
    storageNetInflowNano: string | null;
    epochEndTimestamp: string | null;
};

export type EpochsApiResponse = {
    epochs: EpochRow[];
    nextCursor: string | null;
    hasNextPage: boolean;
};

const fetchEpochPage = unstable_cache(
    async (url: string, cursor: string | null) =>
        new IotaClient({ url }).getEpochMetrics({
            limit: PAGE_SIZE,
            descendingOrder: true,
            cursor: cursor ?? undefined,
        }),
    ["epochsPage"],
    { revalidate: 30 }
);

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const datasetParam = searchParams.get("dataset") ?? "testnet";
    const cursor = searchParams.get("cursor") ?? null;

    if (!(datasetParam in datasets))
        return new Response(JSON.stringify({ error: "Invalid dataset" }), { status: 400 });

    try {
        const page = await fetchEpochPage(datasets[datasetParam], cursor);

        const epochs: EpochRow[] = page.data.map((e) => {
            const eoe = e.endOfEpochInfo;
            const storageNet = eoe
                ? String(BigInt(eoe.storageCharge) - BigInt(eoe.storageRebate))
                : null;
            return {
                epoch: e.epoch,
                totalTransactions: e.epochTotalTransactions,
                stakeRewardsNano: eoe?.totalStakeRewardsDistributed ?? null,
                lastCheckpointId: eoe?.lastCheckpointId ?? null,
                storageNetInflowNano: storageNet,
                epochEndTimestamp: eoe?.epochEndTimestamp ?? null,
            };
        });

        return new Response(
            JSON.stringify({ epochs, nextCursor: page.nextCursor ?? null, hasNextPage: page.hasNextPage }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Failed" }), { status: 500 });
    }
}
