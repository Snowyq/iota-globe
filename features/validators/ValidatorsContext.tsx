"use client";

import {
    ValidatorResponseItem,
    ValidatorsApiResponseData,
} from "@/app/api/validators/route";
import { fetchValidators } from "@/lib/fetchValidators";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { OptionsContext } from "../options/OptionsContext";

export interface Validator extends ValidatorResponseItem {
    stats: {
        stakeIOTA: number;
        stakePercent: number;
        apyPercent: number | null;
        lastEpochRewardIOTA: number | null;
    };
}

interface ValidatorsContextValue {
    validators: Validator[];
    isLoading: boolean;
    networkStats: ValidatorsApiResponseData["systemState"] | null;
    pendingActiveValidatorsSize: string | null;
    dataTtl: number | null;
    selectValidator?: (iotaAddress: string) => void;
    deselectValidator?: () => void;
    selectedValidator?: Validator | null;
}

export const ValidatorsContext = createContext<ValidatorsContextValue>({
    validators: [],
    isLoading: true,
    networkStats: null,
    pendingActiveValidatorsSize: null,
    dataTtl: null,
    selectedValidator: null,
    selectValidator: () => {},
    deselectValidator: () => {},
});

const PULL_INTERVAL_MS = 60_000;

export default function ValidatorsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const [validators, setValidators] = useState<Validator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [networkStats, setNetworkStats] = useState<
        ValidatorsApiResponseData["systemState"] | null
    >(null);
    const [pendingActiveValidatorsSize, setPendingActiveValidatorsSize] =
        useState<string | null>(null);
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
        // eslint-disable-next-line
        setValidators([]);
        setIsLoading(true);
        setNetworkStats(null);
        setPendingActiveValidatorsSize(null);
        setDataTtl(null);

        let firstLoad = true;

        const load = async () => {
            try {
                const { data: info, ttl } = await fetchValidators(network);
                setValidators(
                    info.validators.map((v) => computeStats(v, info))
                );
                setNetworkStats(info.systemState);
                setPendingActiveValidatorsSize(
                    info.pendingActiveValidatorsSize
                );
                setDataTtl(ttl);
            } catch (error) {
                console.error("Failed to refresh validators:", error);
            } finally {
                if (firstLoad) {
                    setIsLoading(false);
                    firstLoad = false;
                }
            }
        };

        load();
        const interval = setInterval(load, PULL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [network]);

    const contextValue = useMemo(
        () => ({
            validators,
            isLoading,
            networkStats,
            pendingActiveValidatorsSize,
            dataTtl,
            selectValidator,
            deselectValidator,
            selectedValidator,
        }),
        [
            validators,
            isLoading,
            networkStats,
            pendingActiveValidatorsSize,
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

type EpochEventParsed = {
    epoch: string;
    validator_address: string;
    pool_staking_reward: string;
};

function computeStats(
    v: ValidatorResponseItem,
    info: ValidatorsApiResponseData
): Validator {
    const reward = info.epochInfoEvents
        .map((e) => e.parsedJson as EpochEventParsed)
        .find((p) => p.validator_address === v.iotaAddress);

    return {
        ...v,
        stats: {
            stakeIOTA: Number(v.payload.stakingPoolIotaBalance) / 1_000_000_000,
            stakePercent: Number(v.payload.votingPower) / 100,
            apyPercent: v.apy != null ? v.apy * 100 : null,
            lastEpochRewardIOTA: reward
                ? Number(reward.pool_staking_reward) / 1_000_000_000
                : null,
        },
    };
}
