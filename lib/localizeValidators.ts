import { IotaValidatorSummary } from "@iota/iota-sdk/client";
import { unstable_cache } from "next/cache";
import dns from "dns/promises";

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

const lookupValidator = unstable_cache(
    async (iotaAddress: string, netAddress: string): Promise<LocalizedValidator> => {
        const host = extractHost(netAddress);
        if (!host) return { iotaAddress, ip: null, geo: null };
        try {
            const { address } = await dns.lookup(host);
            const geo = await getGeoFromIp(address);
            if (!geo) throw new Error("Geo lookup failed");
            return { iotaAddress, ip: address, geo };
        } catch {
            return { iotaAddress, ip: null, geo: null };
        }
    },
    ["validatorGeo"],
    { revalidate: 86400 }
);

export async function getValidatorLocalization(validators: IotaValidatorSummary[]) {
    return Promise.all(
        validators.map((v) => lookupValidator(v.iotaAddress, v.netAddress))
    );
}

function extractHost(addr: string) {
    return addr.match(/\/dns\/([^/]+)/)?.[1] ?? null;
}

async function getGeoFromIp(ip: string): Promise<Geo | null> {
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`, {
            next: { revalidate: 86400 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.status === "success" ? data : null;
    } catch {
        return null;
    }
}
