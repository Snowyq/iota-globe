import { datasetFrom, json } from "@/lib/api";
import { IotaClient } from "@iota/iota-sdk/client";
import { unstable_cache } from "next/cache";
import { type NextRequest } from "next/server";

export const PAGE_SIZE = 20;

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
    { revalidate: 60 * 60 }
);

export async function GET(request: NextRequest) {
    const dataset = datasetFrom(request);
    if (!dataset) return json({ error: "Invalid dataset" }, 400);
    const cursor = request.nextUrl.searchParams.get("cursor");

    try {
        const page = await fetchEpochPage(dataset.url, cursor);

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

        return json({
            epochs,
            nextCursor: page.nextCursor ?? null,
            hasNextPage: page.hasNextPage,
        });
    } catch (e) {
        console.error(e);
        return json({ error: "Failed" }, 500);
    }
}
