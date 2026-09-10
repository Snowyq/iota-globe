"use client";

import {
    type ValidatorResponseItem,
    type ValidatorsApiResponseData,
} from "@/app/api/validators/route";
import { computeValidatorStats, type ValidatorStats } from "./stats";
import { fetchValidators } from "@/lib/fetch";
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

export interface Validator extends ValidatorResponseItem {
    stats: ValidatorStats;
}

interface ValidatorsContextValue {
    refresh: () => void;
    error: string | null;
    validators: Validator[];
    isLoading: boolean;
    networkStats: ValidatorsApiResponseData["systemState"] | null;
    dataTtl: number | null;
    selectValidator?: (iotaAddress: string) => void;
    deselectValidator?: () => void;
    selectedValidator?: Validator | null;
}

export const ValidatorsContext = createContext<ValidatorsContextValue>({
    refresh: () => {},
    error: null,
    validators: [],
    isLoading: true,
    networkStats: null,
    dataTtl: null,
    selectedValidator: null,
    selectValidator: () => {},
    deselectValidator: () => {},
});

const PULL_INTERVAL_MS = 30_000;

export default function ValidatorsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
    const previousNetworkRef = useRef<string | null>(null);
    const [validators, setValidators] = useState<Validator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [networkStats, setNetworkStats] = useState<
        ValidatorsApiResponseData["systemState"] | null
    >(null);

    const [dataTtl, setDataTtl] = useState<number | null>(null);
    const [selectedValidator, setSelectedValidator] =
        useState<Validator | null>(null);

    const selectValidator = useCallback(
        (iotaAddress: string) => {
            const validator = validators.find(
                (v) => v.iotaAddress === iotaAddress
            );
            setSelectedValidator(validator ?? null);
        },
        [validators]
    );

    const deselectValidator = useCallback(() => {
        setSelectedValidator(null);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let pending = false;
        const controller = new AbortController();
        const networkChanged = previousNetworkRef.current !== network;
        previousNetworkRef.current = network;
        if (networkChanged) {
            setValidators([]);
            setNetworkStats(null);
            setDataTtl(null);
            setSelectedValidator(null);
        }
        // A new network or an explicit retry begins a visible request lifecycle.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        if (networkChanged) setError(null);
        let firstLoad = true;

        const load = async () => {
            if (pending) return;
            pending = true;
            try {
                const { data: info, ttl } = await fetchValidators(
                    network,
                    controller.signal
                );
                if (cancelled) return;
                setValidators(
                    info.validators.map((v) => ({
                        ...v,
                        stats: computeValidatorStats(v, info.epochInfoEvents),
                    }))
                );
                setNetworkStats(info.systemState);
                setDataTtl(ttl);
                setError(null);
            } catch {
                if (!cancelled)
                    setError(
                        "Validator data is unavailable. Retrying automatically."
                    );
            } finally {
                pending = false;
                if (firstLoad && !cancelled) {
                    setIsLoading(false);
                    firstLoad = false;
                }
            }
        };

        load();
        const interval = setInterval(load, PULL_INTERVAL_MS);
        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, [network, refreshKey]);

    const contextValue = useMemo(
        () => ({
            refresh,
            error,
            validators,
            isLoading,
            networkStats,
            dataTtl,
            selectValidator,
            deselectValidator,
            selectedValidator,
        }),
        [
            refresh,
            error,
            validators,
            isLoading,
            networkStats,
            dataTtl,
            selectValidator,
            deselectValidator,
            selectedValidator,
        ]
    );

    return (
        <ValidatorsContext.Provider value={contextValue}>
            {children}
        </ValidatorsContext.Provider>
    );
}
