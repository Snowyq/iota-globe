"use client";

import {
    type ValidatorResponseItem,
    type ValidatorsApiResponseData,
} from "@/app/api/validators/route";
import { computeValidatorStats, type ValidatorStats } from "./stats";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { usePolledSnapshot } from "@/hooks/usePolledSnapshot";
import { fetchValidators } from "@/lib/fetch";
import { createContext, useCallback, useMemo, useState } from "react";

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
    const { data, ttl, isLoading, error, refresh } = usePolledSnapshot(
        fetchValidators,
        PULL_INTERVAL_MS,
        "Validator data is unavailable. Retrying automatically."
    );
    const validators = useMemo<Validator[]>(
        () =>
            data?.validators.map((v) => ({
                ...v,
                stats: computeValidatorStats(v, data.epochInfoEvents),
            })) ?? [],
        [data]
    );
    const networkStats = data?.systemState ?? null;
    const [selectedValidator, setSelectedValidator] =
        useState<Validator | null>(null);
    useOnNetworkChange(() => setSelectedValidator(null));

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

    const contextValue = useMemo(
        () => ({
            refresh,
            error,
            validators,
            isLoading,
            networkStats,
            dataTtl: ttl,
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
            ttl,
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
