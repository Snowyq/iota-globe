import { NETWORK_URLS as datasets } from "@/lib/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

type NetworkMetrics = Awaited<ReturnType<IotaClient["getNetworkMetrics"]>>;
type AddressMetrics = Awaited<ReturnType<IotaClient["getAddressMetrics"]>>;
type CirculatingSupply = Awaited<
    ReturnType<IotaClient["getCirculatingSupply"]>
>;
type EpochMetricsPage = Awaited<ReturnType<IotaClient["getEpochMetrics"]>>;
type EndOfEpochInfo = NonNullable<
    EpochMetricsPage["data"][number]["endOfEpochInfo"]
>;

export type NetworkApiResponseData = {
    networkMetrics: NetworkMetrics;
    addressMetrics: AddressMetrics;
    totalDelegators: string | null;
    circulatingSupply: CirculatingSupply | null;
    lastEpochRewards: EndOfEpochInfo | null;
    totalTransactions: string | null;
    lastEpochTransactions: string | null;
};

const TTL_MS = 5_000;

const fetchChainData = unstable_cache(
    async (url: string) => {
        const client = new IotaClient({ url });
        const [
            networkMetrics,
            addressMetrics,
            participationMetrics,
            circulatingSupply,
        ] = await Promise.all([
            client.getNetworkMetrics(),
            client.getAddressMetrics(),
            client.getParticipationMetrics().catch(() => null),
            client.getCirculatingSupply().catch(() => null),
        ]);
        const latestCheckpoint = await client
            .getCheckpoint({ id: networkMetrics.currentCheckpoint })
            .catch(() => null);
        return {
            networkMetrics,
            addressMetrics,
            participationMetrics,
            circulatingSupply,
            latestCheckpoint,
        };
    },
    ["networkChainData"],
    { revalidate: TTL_MS / 1000 }
);

const fetchEpochData = unstable_cache(
    async (url: string) =>
        new IotaClient({ url })
            // last 2 one curr and second last completed
            .getEpochMetrics({ limit: 2, descendingOrder: true })
            .catch(() => null),
    ["networkEpochData"],
    { revalidate: 60 }
);

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";

    if (!(datasetParam in datasets))
        return new Response(JSON.stringify({ error: "Invalid dataset" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });

    const url = datasets[datasetParam as keyof typeof datasets];

    try {
        const [chain, epochMetrics] = await Promise.all([
            fetchChainData(url),
            fetchEpochData(url),
        ]);

        const completedEpoch = epochMetrics?.data?.find(
            (e) => e.endOfEpochInfo != null
        );
        const lastEpochRewards = completedEpoch?.endOfEpochInfo ?? null;
        const lastEpochTransactions =
            completedEpoch?.epochTotalTransactions ?? null;

        const responseData: NetworkApiResponseData = {
            networkMetrics: chain.networkMetrics,
            addressMetrics: chain.addressMetrics,
            totalDelegators: chain.participationMetrics?.totalAddresses ?? null,
            circulatingSupply: chain.circulatingSupply ?? null,
            lastEpochRewards,
            totalTransactions:
                chain.latestCheckpoint?.networkTotalTransactions ?? null,
            lastEpochTransactions,
        };

        return new NextResponse(
            JSON.stringify({
                status: "success",
                ttl: TTL_MS,
                payload: responseData,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error fetching network metrics:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch network metrics" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
