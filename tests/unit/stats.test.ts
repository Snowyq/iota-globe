import { describe, expect, it } from "vitest";
import { computeValidatorStats } from "@/features/validators/stats";
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
