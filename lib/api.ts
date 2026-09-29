import type { NextRequest } from "next/server";

import { NETWORK_URLS } from "./networks";

/** The `?dataset=` network and its RPC url, or null when it is unknown. */
export function datasetFrom(request: NextRequest) {
    const name = request.nextUrl.searchParams.get("dataset") ?? "testnet";
    if (!Object.hasOwn(NETWORK_URLS, name)) return null;
    return { name, url: NETWORK_URLS[name] };
}

export function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
