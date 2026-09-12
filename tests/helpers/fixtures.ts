import type {
    ValidatorResponseItem,
    ValidatorsApiResponseData,
} from "@/app/api/validators/route";
import type { NetworkApiResponseData } from "@/app/api/network/route";
import type { Validator } from "@/features/validators/ValidatorsContext";
import { computeValidatorStats } from "@/features/validators/stats";

export function validatorRecord(
    overrides: Omit<Partial<ValidatorResponseItem>, "payload"> & {
        payload?: Partial<ValidatorResponseItem["payload"]>;
    } = {}
): ValidatorResponseItem {
    return {
        iotaAddress: "0xalpha",
        apy: 0.05,
        isCommitteeMember: true,
        isAtRisk: false,
        atRiskGracePeriod: null,
        geo: {
            country: "Poland",
            countryCode: "PL",
            region: "14",
            regionName: "Mazowieckie",
            city: "Warsaw",
            zip: "00-001",
            lat: 52.23,
            lon: 21.01,
            timezone: "Europe/Warsaw",
            query: "203.0.113.1",
        },
        ...overrides,
        payload: {
            name: "Alpha",
            description: "Example validator",
            imageUrl: "",
            projectUrl: "https://example.com",
            authorityPubkeyBytes: "key",
            commissionRate: "200",
            effectiveCommissionRate: "200",
            exchangeRatesId: "0xexchange",
            exchangeRatesSize: "0",
            gasPrice: "1000",
            netAddress: "/dns/node.example.com/tcp/8080",
            networkPubkeyBytes: "key",
            nextEpochCommissionRate: "200",
            nextEpochGasPrice: "1000",
            nextEpochStake: "100000000000",
            operationCapId: "0xcap",
            p2pAddress: "/dns/node.example.com/udp/8080",
            pendingPoolTokenWithdraw: "0",
            pendingStake: "0",
            pendingTotalIotaWithdraw: "0",
            poolTokenBalance: "100000000000",
            primaryAddress: "node.example.com",
            proofOfPossessionBytes: "proof",
            protocolPubkeyBytes: "protocol-key",
            rewardsPool: "5000000000",
            stakingPoolId: "0xpool",
            stakingPoolIotaBalance: "100000000000",
            votingPower: "250",
            ...overrides.payload,
        },
    };
}
export function validator(
    overrides: Parameters<typeof validatorRecord>[0] = {}
): Validator {
    const record = validatorRecord(overrides);
    return { ...record, stats: computeValidatorStats(record, []) };
}
export function rewardEvent(
    address: string,
    rewardNano: string
): ValidatorsApiResponseData["epochInfoEvents"][number] {
    return {
        id: { txDigest: "event-digest", eventSeq: "0" },
        packageId: "0x3",
        parsedJson: {
            epoch: "42",
            validator_address: address,
            pool_staking_reward: rewardNano,
        },
        sender: "0x0",
        transactionModule: "validator_set",
        type: "0x3::validator_set::ValidatorEpochInfoEventV1",
        bcs: "",
        bcsEncoding: "base64",
    };
}
export function networkSnapshot(
    overrides: Partial<NetworkApiResponseData> = {}
): NetworkApiResponseData {
    return {
        networkMetrics: {
            currentCheckpoint: "1000",
            currentEpoch: "42",
            currentTps: 12,
            totalAddresses: "200",
            totalObjects: "10000",
            totalPackages: "30",
            tps30Days: 100,
        },
        addressMetrics: {
            checkpoint: "1000",
            cumulativeActiveAddresses: "100",
            cumulativeAddresses: "200",
            dailyActiveAddresses: "10",
            epoch: "42",
            timestampMs: "1700000000000",
        },
        totalDelegators: "20",
        circulatingSupply: {
            value: "1000000000000",
            atCheckpoint: "1000",
            circulatingSupplyPercentage: 0.5,
        },
        lastEpochRewards: null,
        totalTransactions: "1500",
        lastEpochTransactions: "250",
        ...overrides,
    };
}

export function validatorsSnapshot(
    validators: ValidatorResponseItem[] = [validatorRecord()]
): ValidatorsApiResponseData {
    return {
        validators,
        epochInfoEvents: [],
        pendingActiveValidatorsSize: "0",
        systemState: {
            epoch: "42",
            epochDurationMs: "86400000",
            epochStartTimestampMs: "1700000000000",
            inactivePoolsId: "0",
            inactivePoolsSize: "0",
            iotaTotalSupply: "2000000000000",
            iotaTreasuryCapId: "0",
            maxValidatorCount: "0",
            minValidatorCount: "0",
            minValidatorJoiningStake: "0",
            pendingActiveValidatorsId: "0",
            pendingActiveValidatorsSize: "0",
            pendingRemovals: [],
            protocolVersion: "0",
            referenceGasPrice: "0",
            safeMode: false,
            safeModeComputationCharges: "0",
            safeModeComputationChargesBurned: "0",
            safeModeNonRefundableStorageFee: "0",
            safeModeStorageCharges: "0",
            safeModeStorageRebates: "0",
            stakingPoolMappingsId: "0",
            stakingPoolMappingsSize: "0",
            storageFundNonRefundableBalance: "0",
            storageFundTotalObjectStorageRebates: "0",
            systemStateVersion: "0",
            totalStake: "0",
            validatorCandidatesId: "0",
            validatorCandidatesSize: "0",
            validatorLowStakeGracePeriod: "0",
            validatorLowStakeThreshold: "0",
            validatorReportRecords: [],
            validatorVeryLowStakeThreshold: "0",
        },
    };
}
