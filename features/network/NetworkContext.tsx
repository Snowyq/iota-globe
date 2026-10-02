"use client";

import type { NetworkApiResponseData } from "@/app/api/network/route";
import { usePolledSnapshot } from "@/hooks/usePolledSnapshot";
import { fetchNetwork } from "@/lib/fetch";
import { createContext, useMemo } from "react";

interface NetworkContextValue {
    networkMetrics: NetworkApiResponseData["networkMetrics"] | null;
    addressMetrics: NetworkApiResponseData["addressMetrics"] | null;
    totalDelegators: string | null;
    circulatingSupply: NetworkApiResponseData["circulatingSupply"] | null;
    lastEpochRewards: NetworkApiResponseData["lastEpochRewards"] | null;
    totalTransactions: string | null;
    lastEpochTransactions: string | null;
    isLoading: boolean;
    dataTtl: number | null;
    refresh: () => void;
    error: string | null;
    updatedAt: number | null;
}

export const NetworkContext = createContext<NetworkContextValue>({
    refresh: () => {},
    networkMetrics: null,
    addressMetrics: null,
    totalDelegators: null,
    circulatingSupply: null,
    lastEpochRewards: null,
    totalTransactions: null,
    lastEpochTransactions: null,
    isLoading: true,
    dataTtl: null,
    error: null,
    updatedAt: null,
});

export default function NetworkContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data, ttl, updatedAt, isLoading, error, refresh } =
        usePolledSnapshot(
            fetchNetwork,
            5_000,
            "Unable to reach the network. Retrying automatically."
        );

    const value = useMemo(
        () => ({
            refresh,
            networkMetrics: data?.networkMetrics ?? null,
            addressMetrics: data?.addressMetrics ?? null,
            totalDelegators: data?.totalDelegators ?? null,
            circulatingSupply: data?.circulatingSupply ?? null,
            lastEpochRewards: data?.lastEpochRewards ?? null,
            totalTransactions: data?.totalTransactions ?? null,
            lastEpochTransactions: data?.lastEpochTransactions ?? null,
            isLoading,
            dataTtl: ttl,
            error,
            updatedAt,
        }),
        [data, isLoading, ttl, error, updatedAt, refresh]
    );
    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
}
