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

type WithStats = { stats: ValidatorStats };

export function totalStake(validators: WithStats[]) {
    return validators.reduce((sum, v) => sum + v.stats.stakeIOTA, 0);
}

/** Unweighted mean APY, or null when no validator reports one. */
export function meanApy(validators: WithStats[]) {
    const apys = validators.flatMap((v) =>
        v.stats.apyPercent == null ? [] : [v.stats.apyPercent]
    );
    return apys.length ? apys.reduce((a, b) => a + b, 0) / apys.length : null;
}

/** Fewest validators with over a third of voting power, or null if none. */
export function nakamotoCoefficient(votingPower: number[]): number | null {
    const sorted = votingPower
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b - a);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    if (!total) return null;
    let running = 0;
    for (let i = 0; i < sorted.length; i++) {
        running += sorted[i];
        if (running > total / 3) return i + 1;
    }
    return sorted.length;
}
