import { LiveApiResponseData } from "@/app/api/live/route";

export type FetchResult<T> = { data: T; ttl: number };

export async function fetchLive(network: string): Promise<FetchResult<LiveApiResponseData>> {
    const response = await fetch(`/api/live?dataset=${network}`);
    const json = await response.json();

    if (json.status !== "success" || !json.payload) {
        throw new Error(json.error ?? "Failed to fetch live metrics");
    }

    return { data: json.payload, ttl: json.ttl ?? 1000 };
}
