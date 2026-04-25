import { NetworkApiResponseData } from "@/app/api/network/route";
import { FetchResult } from "@/lib/fetchLive";

export async function fetchNetwork(network: string): Promise<FetchResult<NetworkApiResponseData>> {
    const response = await fetch(`/api/network?dataset=${network}`);
    const json = await response.json();

    if (json.status !== "success" || !json.payload) {
        throw new Error(json.error ?? "Failed to fetch network metrics");
    }

    return { data: json.payload, ttl: json.ttl ?? 5000 };
}
