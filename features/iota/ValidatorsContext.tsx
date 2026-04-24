"use client";

import { IotaApiResponseData, ValidatorResponseItem } from "@/app/api/route";
import { fetchIota } from "@/lib/fetchIota";
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
    selectValidator?: (iotaAddress: string) => void;
    deselectValidator?: () => void;
    selectedValidator?: Validator | null;
}

export const ValidatorsContext = createContext<ValidatorsContextValue>({
    validators: [],
    isLoading: true,
    selectedValidator: null,
    selectValidator: () => {},
    deselectValidator: () => {},
});

export default function ValidatorsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const [validators, setValidators] = useState<Validator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedValidator, setSelectedValidator] =
        useState<Validator | null>(null);

    const validatorsSignatureRef = useRef("");

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
        setValidators([]);
        setIsLoading(true);
        validatorsSignatureRef.current = "";

        let firstLoad = true;

        const load = async () => {
            try {
                const info = await fetchIota(network);
                console.log("Fetched IOTA data:", info);
                // const nextSignature = buildValidatorsSignature(info.validators);

                // if (validatorsSignatureRef.current === nextSignature) return;

                // validatorsSignatureRef.current = nextSignature;
                console.log("Updating validators state with new data");
                setValidators(
                    info.validators.map((v) => computeStats(v, info))
                );
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
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [network]);

    const contextValue = useMemo(
        () => ({
            validators,
            isLoading,
            selectValidator,
            deselectValidator,
            selectedValidator,
        }),
        [
            validators,
            isLoading,
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
    info: IotaApiResponseData
): Validator {
    // Events are descending — first match is the most recent epoch's reward
    const reward = info.epochInfoEvents
        .map((e) => e.parsedJson as EpochEventParsed)
        .find((p) => p.validator_address === v.iotaAddress);

    return {
        ...v,
        stats: {
            stakeIOTA:
                Number(v.payload.stakingPoolIotaBalance) /
                1_000_000_000_000_000,
            stakePercent: Number(v.payload.votingPower) / 100,
            apyPercent: v.apy != null ? v.apy * 100 : null,
            lastEpochRewardIOTA: reward
                ? Number(reward.pool_staking_reward) / 1_000_000_000_000
                : null,
        },
    };
}

function buildValidatorsSignature(validators: ValidatorResponseItem[]) {
    return validators
        .map((v) => {
            const geo = v.geo ? `${v.geo.lat}:${v.geo.lon}` : "none";
            return `${v.payload.netAddress}|${v.geo?.query ?? "none"}|${geo}`;
        })
        .sort()
        .join(";");
}
