import { describe, expect, it } from "vitest";
import {
    computeValidatorStats,
    nakamotoCoefficient,
} from "@/features/validators/stats";
import { validatorRecord, rewardEvent } from "../helpers/fixtures";

describe("validator statistics", () => {
    it("converts stake, APY, voting power and rewards with independent units", () => {
        const record = validatorRecord({
            apy: 0.0525,
            payload: {
                stakingPoolIotaBalance: "1250000000000",
                votingPower: "345",
            },
        });
        expect(
            computeValidatorStats(record, [
                rewardEvent(record.iotaAddress, "1500000000"),
            ])
        ).toEqual({
            stakeIOTA: 1250,
            stakePercent: 3.45,
            apyPercent: 5.25,
            lastEpochRewardIOTA: 1.5,
        });
    });
    it("matches rewards by address instead of event ordering", () => {
        const record = validatorRecord();
        expect(
            computeValidatorStats(record, [
                rewardEvent("0xother", "99000000000"),
                rewardEvent(record.iotaAddress, "2000000000"),
            ]).lastEpochRewardIOTA
        ).toBe(2);
    });
    it("does not turn missing APY or reward data into zero", () =>
        expect(
            computeValidatorStats(validatorRecord({ apy: null }), [])
        ).toMatchObject({ apyPercent: null, lastEpochRewardIOTA: null }));
    it("preserves actual zero APY and rewards", () =>
        expect(
            computeValidatorStats(validatorRecord({ apy: 0 }), [
                rewardEvent("0xalpha", "0"),
            ])
        ).toMatchObject({ apyPercent: 0, lastEpochRewardIOTA: 0 }));
    it("ignores events without parsed data", () => {
        const event = { ...rewardEvent("0xother", "0"), parsedJson: null };
        expect(
            computeValidatorStats(validatorRecord(), [event])
                .lastEpochRewardIOTA
        ).toBeNull();
    });
});

describe("nakamoto coefficient", () => {
    it("counts the fewest validators holding more than a third of voting power", () => {
        expect(nakamotoCoefficient([40, 30, 20, 10])).toBe(1);
        expect(nakamotoCoefficient([25, 25, 25, 25])).toBe(2);
        expect(
            nakamotoCoefficient([10, 10, 10, 10, 10, 10, 10, 10, 10, 10])
        ).toBe(4);
    });
    it("ignores missing values and reports null without voting power", () => {
        expect(nakamotoCoefficient([])).toBeNull();
        expect(nakamotoCoefficient([0, Number.NaN])).toBeNull();
        expect(nakamotoCoefficient([Number.NaN, 50, 50])).toBe(1);
    });
});
