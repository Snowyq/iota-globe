"use client";

import { NetworkApiResponseData } from "@/app/api/network/route";
import { fetchNetwork } from "@/lib/fetch";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { OptionsContext } from "../options/OptionsContext";

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
}

export const NetworkContext = createContext<NetworkContextValue>({
    networkMetrics: null,
    addressMetrics: null,
    totalDelegators: null,
    circulatingSupply: null,
    lastEpochRewards: null,
    totalTransactions: null,
    lastEpochTransactions: null,
    isLoading: true,
    dataTtl: null,
});

export default function NetworkContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const [networkMetrics, setNetworkMetrics] = useState<
        NetworkApiResponseData["networkMetrics"] | null
    >(null);
    const [addressMetrics, setAddressMetrics] = useState<
        NetworkApiResponseData["addressMetrics"] | null
    >(null);
    const [totalDelegators, setTotalDelegators] = useState<string | null>(null);
    const [circulatingSupply, setCirculatingSupply] = useState<
        NetworkApiResponseData["circulatingSupply"] | null
    >(null);
    const [lastEpochRewards, setLastEpochRewards] = useState<
        NetworkApiResponseData["lastEpochRewards"] | null
    >(null);
    const [totalTransactions, setTotalTransactions] = useState<string | null>(
        null
    );
    const [lastEpochTransactions, setLastEpochTransactions] = useState<
        string | null
    >(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dataTtl, setDataTtl] = useState<number | null>(null);

    useEffect(() => {
        // Reset all data when network changes
        // eslint-disable-next-line
        setNetworkMetrics(null);
        setAddressMetrics(null);
        setTotalDelegators(null);
        setCirculatingSupply(null);
        setLastEpochRewards(null);
        setTotalTransactions(null);
        setLastEpochTransactions(null);
        setIsLoading(true);
        setDataTtl(null);

        let firstLoad = true;

        const load = async () => {
            try {
                const { data, ttl } = await fetchNetwork(network);
                setNetworkMetrics(data.networkMetrics);
                setAddressMetrics(data.addressMetrics);
                setTotalDelegators(data.totalDelegators);
                setCirculatingSupply(data.circulatingSupply);
                setLastEpochRewards(data.lastEpochRewards);
                setTotalTransactions(data.totalTransactions);
                setLastEpochTransactions(data.lastEpochTransactions);
                setDataTtl(ttl);
            } catch (error) {
                console.error("Failed to refresh network metrics:", error);
            } finally {
                if (firstLoad) {
                    setIsLoading(false);
                    firstLoad = false;
                }
            }
        };

        load();
        const interval = setInterval(load, 5_000);
        return () => clearInterval(interval);
    }, [network]);

    const contextValue = useMemo(
        () => ({
            networkMetrics,
            addressMetrics,
            totalDelegators,
            circulatingSupply,
            lastEpochRewards,
            totalTransactions,
            lastEpochTransactions,
            isLoading,
            dataTtl,
        }),
        [
            networkMetrics,
            addressMetrics,
            totalDelegators,
            circulatingSupply,
            lastEpochRewards,
            totalTransactions,
            lastEpochTransactions,
            isLoading,
            dataTtl,
        ]
    );

    return (
        <NetworkContext.Provider value={contextValue}>
            {children}
        </NetworkContext.Provider>
    );
}
