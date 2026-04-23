import { cachedFetch } from "@/lib/cache";
import { IotaValidatorSummary } from "@iota/iota-sdk/client";
import dns from "dns/promises";

const TTL = 24 * 60 * 60_000;

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

export async function getValidatorLocalization(
    validators: IotaValidatorSummary[]
) {
    return Promise.all(
        validators.map((validator) =>
            cachedFetch<LocalizedValidator>(
                validator.netAddress,
                TTL,
                async () => {
                    const host = extractHost(validator.netAddress);
                    if (!host)
                        return {
                            iotaAddress: validator.iotaAddress,
                            ip: null,
                            geo: null,
                        };

                    try {
                        const { address } = await dns.lookup(host);
                        const geo = await getGeoFromIp(address);
                        if (!geo) throw new Error("Geo lookup failed");
                        return {
                            iotaAddress: validator.iotaAddress,
                            ip: address,
                            geo: {
                                lat: geo.lat,
                                lon: geo.lon,
                                zip: geo.zip,
                                timezone: geo.timezone,
                                city: geo.city,
                                region: geo.region,
                                regionName: geo.regionName,
                                country: geo.country,
                                countryCode: geo.countryCode,
                                query: geo.query,
                            },
                        };
                    } catch {
                        return {
                            iotaAddress: validator.iotaAddress,
                            ip: null,
                            geo: null,
                        };
                    }
                }
            )
        )
    );
}

function extractHost(addr: string) {
    return addr.match(/\/dns\/([^/]+)/)?.[1] ?? null;
}

async function getGeoFromIp(ip: string): Promise<Geo | null> {
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.status === "success" ? data : null;
    } catch {
        return null;
    }
}
