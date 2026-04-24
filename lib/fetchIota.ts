import { IotaApiResponseData } from "@/app/api/route";

export async function fetchIota(network: string): Promise<IotaApiResponseData> {
    try {
        const response = await fetch(`/api?dataset=${network}`);
        const data = await response.json();

        if (data.status !== "success" || !data.payload) {
            throw new Error(data.error ?? "Failed to fetch validators");
        }

        return data.payload;
    } catch (e) {
        const message =
            e instanceof Error
                ? e.message
                : "An error occurred while fetching validators";
        console.error("Error fetching validators:", e);
        throw new Error(message);
    }
}
