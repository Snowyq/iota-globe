import { ValidatorsApiResponseData } from "@/app/api/validators/route";
import { FetchResult } from "@/lib/fetch";

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
