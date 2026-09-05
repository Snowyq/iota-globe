import type { NetworkApiResponseData } from "@/app/api/network/route";
import type { ValidatorsApiResponseData } from "@/app/api/validators/route";

export type FetchResult<T> = { data: T; ttl: number };

async function fetchSnapshot<T>(
    path: string,
    network: string,
    ttl: number,
    signal?: AbortSignal
): Promise<FetchResult<T>> {
    // A stalled request must eventually become a recoverable error state.
    const timeout = AbortSignal.timeout(20_000);
    const response = await fetch(
        `${path}?dataset=${encodeURIComponent(network)}`,
        { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }
    );
    if (!response.ok)
        throw new Error(`Network request failed (${response.status})`);
    const json = await response.json();
    if (json.status !== "success" || !json.payload)
        throw new Error(json.error ?? "Network data is unavailable");
    return { data: json.payload, ttl: json.ttl ?? ttl };
}
export function fetchNetwork(network: string, signal?: AbortSignal) {
    return fetchSnapshot<NetworkApiResponseData>(
        "/api/network",
        network,
        5000,
        signal
    );
}
export function fetchValidators(network: string, signal?: AbortSignal) {
    return fetchSnapshot<ValidatorsApiResponseData>(
        "/api/validators",
        network,
        30000,
        signal
    );
}
