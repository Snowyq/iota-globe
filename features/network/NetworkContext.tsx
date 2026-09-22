"use client";

import type { NetworkApiResponseData } from "@/app/api/network/route";
import { fetchNetwork } from "@/lib/fetch";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
    const { network } = useContext(OptionsContext);
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
    const previousNetworkRef = useRef<string | null>(null);
    const [data, setData] = useState<NetworkApiResponseData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dataTtl, setDataTtl] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        let pending = false;
        const controller = new AbortController();
        const networkChanged = previousNetworkRef.current !== network;
        previousNetworkRef.current = network;
        if (networkChanged) {
            setData(null);
            setUpdatedAt(null);
            setDataTtl(null);
        }
        // A new network or an explicit retry begins a visible request lifecycle.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        if (networkChanged) setError(null);
        const load = async () => {
            if (pending) return;
            pending = true;
            try {
                const result = await fetchNetwork(network, controller.signal);
                if (cancelled) return;
                setData(result.data);
                setDataTtl(result.ttl);
                setUpdatedAt(Date.now());
                setError(null);
            } catch {
                if (!cancelled)
                    setError(
                        "Unable to reach the network. Retrying automatically."
                    );
            } finally {
                pending = false;
                if (!cancelled) setIsLoading(false);
            }
        };
        void load();
        const interval = setInterval(load, 5_000);
        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, [network, refreshKey]);

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
            dataTtl,
            error,
            updatedAt,
        }),
        [data, isLoading, dataTtl, error, updatedAt, refresh]
    );
    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
}
