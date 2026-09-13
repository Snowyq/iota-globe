import type {
    ValidatorResponseItem,
    ValidatorsApiResponseData,
} from "@/app/api/validators/route";

export interface ValidatorStats {
    stakeIOTA: number;
    stakePercent: number;
    apyPercent: number | null;
    lastEpochRewardIOTA: number | null;
}
type EpochEventParsed = {
    validator_address: string;
    pool_staking_reward: string;
};

export function computeValidatorStats(
    validator: ValidatorResponseItem,
    events: ValidatorsApiResponseData["epochInfoEvents"]
): ValidatorStats {
    const reward = events
        .map((event) => event.parsedJson as EpochEventParsed)
        .find((event) => event?.validator_address === validator.iotaAddress);
    return {
        stakeIOTA: Number(validator.payload.stakingPoolIotaBalance) / 1e9,
        stakePercent: Number(validator.payload.votingPower) / 100,
        apyPercent: validator.apy != null ? validator.apy * 100 : null,
        lastEpochRewardIOTA: reward
            ? Number(reward.pool_staking_reward) / 1e9
            : null,
    };
}
