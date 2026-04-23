"use client";

import { ValidatorResponseItem } from "@/app/api/route";
import { fetchIota } from "@/lib/fetchIota";
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

export type ValidatorStats = {
    stakeIOTA: number;
    stakePercent: number;
    apyPercent: number | null;
    lastEpochRewardIOTA: number | null;
};

interface ValidatorsContext {
    validators: ValidatorResponseItem[];
    selectValidator?: (iotaAddress: string) => void;
    deselectValidator?: () => void;
    selectedValidator?: ValidatorResponseItem | null;
}

export const ValidatorsContext = createContext<ValidatorsContext>({
    validators: [],
    selectedValidator: null,
    selectValidator: () => {},
    deselectValidator: () => {},
});

export default function ValidatorsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [validators, setValidators] = useState<ValidatorResponseItem[]>([]);
    const [selectedValidator, setSelectedValidator] =
        useState<ValidatorResponseItem | null>(null);

    const validatorsSignatureRef = useRef("");

    const selectValidator = useCallback(
        (iotaAddress: string) => {
            console.log("Selecting validator with IOTA address:", iotaAddress);

            const validator = validators.find(
                (v) => v.iotaAddress === iotaAddress
            );
            setSelectedValidator(validator ?? null);
            console.log("Selected validator:", validator);
        },
        [validators]
    );

    const deselectValidator = useCallback(() => {
        setSelectedValidator(null);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const info = await fetchIota();
                const nextSignature = buildValidatorsSignature(info.validators);

                if (validatorsSignatureRef.current === nextSignature) {
                    return;
                }

                validatorsSignatureRef.current = nextSignature;
                setValidators(info.validators);
            } catch (error) {
                console.error("Failed to refresh validators:", error);
            }
        };

        load();
        const interval = setInterval(load, 5000);

        return () => clearInterval(interval);
    }, []);

    const contextValue = useMemo(
        () => ({
            validators,
            selectValidator,
            deselectValidator,
            selectedValidator,
        }),
        [validators, selectValidator, deselectValidator, selectedValidator]
    );

    return (
        <ValidatorsContext.Provider value={contextValue}>
            {children}
        </ValidatorsContext.Provider>
    );
}

// function computeValidatorStats(v: ValidatorResponseItem): ValidatorWithStats {
//     return {
//         ...v,
//         stakeIOTA:
//             Number(v.payload.stakingPoolIotaBalance) / 1_000_000_000_000_000,
//         stakePercent: Number(v.payload.votingPower) / 100,
//         apyPercent: v.apy != null ? v.apy * 100 : null,
//         lastEpochRewardIOTA:
//             v.lastEpochReward != null
//                 ? Number(v.lastEpochReward) / 1_000_000_000_000
//                 : null,
//     };
// }

function buildValidatorsSignature(validators: ValidatorResponseItem[]) {
    return validators
        .map((validator) => {
            const geo = validator.geo
                ? `${validator.geo.lat}:${validator.geo.lon}`
                : "none";

            return `${validator.payload.netAddress}|${validator.geo?.query ?? "none"}|${geo}`;
        })
        .sort()
        .join(";");
}
