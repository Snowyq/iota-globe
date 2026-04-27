import { IotaValidatorSummary } from "@iota/iota-sdk/client";
import dns from "dns/promises";
import { unstable_cache } from "next/cache";

export type Geo = {
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    query: string;
};

export type LocalizedValidator = {
    iotaAddress: string;
    ip: string | null;
    geo: Geo | null;
};

const resolveValidatorIp = unstable_cache(
    async (
        iotaAddress: string,
        netAddress: string
    ): Promise<{ iotaAddress: string; ip: string | null }> => {
        const host = netAddress.match(/\/dns\/([^/]+)/)?.[1] ?? null;
        if (!host) return { iotaAddress, ip: null };
        try {
            const { address } = await dns.lookup(host);
            return { iotaAddress, ip: address };
        } catch {
            return { iotaAddress, ip: null };
        }
    },
    ["validatorIp"],
    { revalidate: 3_600 }
);

// keyed by sorted IPs so cache key is stable regardless of validator order
const fetchGeoBatch = unstable_cache(
    async (ips: string[]): Promise<[string, Geo][]> => {
        try {
            const res = await fetch("http://ip-api.com/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ips.map((ip) => ({ query: ip }))),
                signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) return [];
            const data = (await res.json()) as Array<Geo & { status: string }>;
            return data.filter((item) => item.status === "success").map((item) => [item.query, item]);
        } catch {
            return [];
        }
    },
    ["geoBatch"],
    { revalidate: 3_600 }
);

export async function getValidatorLocalization(
    validators: IotaValidatorSummary[]
): Promise<LocalizedValidator[]> {
    const withIps = await Promise.all(
        validators.map((v) => resolveValidatorIp(v.iotaAddress, v.netAddress))
    );

    const ips = [
        ...new Set(
            withIps.map((v) => v.ip).filter((ip): ip is string => ip !== null)
        ),
    ].sort();

    const geoMap = new Map(await fetchGeoBatch(ips));

    return withIps.map((v) => ({
        iotaAddress: v.iotaAddress,
        ip: v.ip,
        geo: v.ip ? (geoMap.get(v.ip) ?? null) : null,
    }));
}
