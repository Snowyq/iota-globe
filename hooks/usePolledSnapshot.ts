"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import type { FetchResult } from "@/lib/fetch";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

type Fetcher<T> = (
    network: string,
    signal: AbortSignal
) => Promise<FetchResult<T>>;

/**
 * Polls an API snapshot for the selected network. A failed poll keeps the
 * last data; switching networks clears it.
 */
export function usePolledSnapshot<T>(
    fetchSnapshot: Fetcher<T>,
    intervalMs: number,
    errorMessage: string
) {
    const { network } = useContext(OptionsContext);
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
    const previousNetwork = useRef<string | null>(null);
    const [data, setData] = useState<T | null>(null);
    const [ttl, setTtl] = useState<number | null>(null);
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let pending = false;
        const controller = new AbortController();
        const networkChanged = previousNetwork.current !== network;
        previousNetwork.current = network;
        if (networkChanged) {
            setData(null);
            setTtl(null);
            setUpdatedAt(null);
        }
        // A new network or a manual retry shows the loading state again.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        if (networkChanged) setError(null);

        const load = async () => {
            if (pending) return;
            pending = true;
            try {
                const result = await fetchSnapshot(network, controller.signal);
                if (cancelled) return;
                setData(result.data);
                setTtl(result.ttl);
                setUpdatedAt(Date.now());
                setError(null);
            } catch {
                if (!cancelled) setError(errorMessage);
            } finally {
                pending = false;
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        const interval = setInterval(load, intervalMs);
        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, [network, refreshKey, fetchSnapshot, intervalMs, errorMessage]);

    return { data, ttl, updatedAt, isLoading, error, refresh };
}
