export type FetchResult<T> = { data: T; ttl: number };

import { NetworkApiResponseData } from "@/app/api/network/route";

export async function fetchNetwork(
    network: string
): Promise<FetchResult<NetworkApiResponseData>> {
    const response = await fetch(`/api/network?dataset=${network}`);
    const json = await response.json();

    if (json.status !== "success" || !json.payload) {
        throw new Error(json.error ?? "Failed to fetch network metrics");
    }

    return { data: json.payload, ttl: json.ttl ?? 5000 };
}

import { ValidatorsApiResponseData } from "@/app/api/validators/route";

export async function fetchValidators(
    network: string
): Promise<FetchResult<ValidatorsApiResponseData>> {
    const response = await fetch(`/api/validators?dataset=${network}`);
    const json = await response.json();

    if (json.status !== "success" || !json.payload) {
        throw new Error(json.error ?? "Failed to fetch validators");
    }

    return { data: json.payload, ttl: json.ttl ?? 30000 };
}
