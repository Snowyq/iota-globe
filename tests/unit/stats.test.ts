import { describe, expect, it } from "vitest";
import {
    computeValidatorStats,
    nakamotoCoefficient,
} from "@/features/validators/stats";
import { validatorRecord, rewardEvent } from "../helpers/fixtures";

describe("validator stats", () => {
    it("converts stake, APY, voting power and rewards", () => {
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

    it("matches rewards by address", () => {
        const record = validatorRecord();
        const unparsed = { ...rewardEvent("0xother", "0"), parsedJson: null };
        expect(
            computeValidatorStats(record, [
                unparsed,
                rewardEvent("0xother", "99000000000"),
                rewardEvent(record.iotaAddress, "2000000000"),
            ]).lastEpochRewardIOTA
        ).toBe(2);
    });

    it("keeps missing data apart from zero", () => {
        expect(
            computeValidatorStats(validatorRecord({ apy: null }), [])
        ).toMatchObject({ apyPercent: null, lastEpochRewardIOTA: null });
        expect(
            computeValidatorStats(validatorRecord({ apy: 0 }), [
                rewardEvent("0xalpha", "0"),
            ])
        ).toMatchObject({ apyPercent: 0, lastEpochRewardIOTA: 0 });
    });
});

describe("nakamotoCoefficient", () => {
    it("counts validators needed for over a third of voting power", () => {
        expect(nakamotoCoefficient([40, 30, 20, 10])).toBe(1);
        expect(nakamotoCoefficient([25, 25, 25, 25])).toBe(2);
        expect(nakamotoCoefficient(Array(10).fill(10))).toBe(4);
        expect(nakamotoCoefficient([Number.NaN, 50, 50])).toBe(1);
    });

    it("returns null without voting power", () => {
        expect(nakamotoCoefficient([])).toBeNull();
        expect(nakamotoCoefficient([0, Number.NaN])).toBeNull();
    });
});
