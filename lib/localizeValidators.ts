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
        // extract host [ignore] /dns/ [take] / [ignore]
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
    { revalidate: 60 }
);

const GEO_TIMEOUT_MS = 4_000;

const resolveIpGeo = unstable_cache(
    async (ip: string): Promise<Geo | null> => {
        try {
            const res = await fetch(`http://ip-api.com/json/${ip}`, {
                signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.status === "success" ? data : null;
        } catch {
            return null;
        }
    },
    ["validatorGeo"],
    { revalidate: 3_600 }
);

export async function getValidatorLocalization(
    validators: IotaValidatorSummary[]
): Promise<LocalizedValidator[]> {
    // Resolve IPS from DNS in parallel
    const withIps = await Promise.all(
        validators.map((v) => resolveValidatorIp(v.iotaAddress, v.netAddress))
    );

    // prepare all IPS for batch lookip
    const ips = [
        ...new Set(withIps.filter((v) => v.ip !== null).map((v) => v.ip!)),
    ];

    // batch resolving geolocaton parallel
    const geoEntries = await Promise.all(
        ips.map(async (ip) => [ip, await resolveIpGeo(ip)] as const)
    );

    // filtering and mapping geolocation results for easy and predictable access
    const geoMap = new Map(
        geoEntries.filter((e): e is [string, Geo] => e[1] !== null)
    );

    console.log("sending geo");
    return withIps.map((v) => ({
        iotaAddress: v.iotaAddress,
        ip: v.ip,
        geo: v.ip ? geoMap.get(v.ip) || null : null,
    }));
}
