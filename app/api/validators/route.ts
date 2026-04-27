import { getValidatorLocalization } from "@/lib/localizeValidators";
import { NETWORK_URLS as datasets } from "@/lib/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { unstable_cache } from "next/cache";
import { type NextRequest } from "next/server";

const VALIDATOR_EPOCH_INFO_EVENT =
    "0x3::validator_set::ValidatorEpochInfoEventV1";
const MAX_EVENTS_PER_PAGE = 50;

const TTL_MS = 15_000;

type SystemState = Awaited<ReturnType<IotaClient["getLatestIotaSystemState"]>>;
type ValidatorsApy = Awaited<ReturnType<IotaClient["getValidatorsApy"]>>;
type ValidatorGeo = Awaited<ReturnType<typeof getValidatorLocalization>>;
type EpochInfoEvent = Awaited<
    ReturnType<IotaClient["queryEvents"]>
>["data"][number];
type Validator = SystemState["activeValidators"][number];
type ApiSystemState = Omit<
    SystemState,
    "activeValidators" | "committeeMembers" | "atRiskValidators"
> & {
    activeValidators?: undefined;
    committeeMembers?: undefined;
    atRiskValidators?: undefined;
};

export type ValidatorResponseItem = {
    iotaAddress: Validator["iotaAddress"];
    apy: ValidatorsApy["apys"][number]["apy"] | null;
    geo: ValidatorGeo[number]["geo"] | null;
    isCommitteeMember: boolean;
    isAtRisk: boolean;
    atRiskGracePeriod: string | null;
    payload: Omit<Validator, "iotaAddress"> & { iotaAddress?: undefined };
};

export type ValidatorsApiResponseData = {
    systemState: ApiSystemState;
    validators: ValidatorResponseItem[];
    epochInfoEvents: EpochInfoEvent[];
    pendingActiveValidatorsSize: string;
};

const fetchSystemState = unstable_cache(
    async (url: string) => new IotaClient({ url }).getLatestIotaSystemState(),
    ["validatorsSystemState"],
    { revalidate: TTL_MS / 1000 }
);

const fetchValidatorsApy = unstable_cache(
    async (url: string) => new IotaClient({ url }).getValidatorsApy(),
    ["validatorsApy"],
    { revalidate: TTL_MS / 1000 }
);

const fetchEpochEvents = unstable_cache(
    async (url: string, count: number) => {
        const client = new IotaClient({ url });
        const allEvents: EpochInfoEvent[] = [];
        let cursor = undefined;
        for (let i = 0; allEvents.length < count && i < 5; i++) {
            const page = await client.queryEvents({
                query: { MoveEventType: VALIDATOR_EPOCH_INFO_EVENT },
                limit: MAX_EVENTS_PER_PAGE,
                order: "descending",
                cursor,
            });
            allEvents.push(...page.data);
            if (!page.hasNextPage) break;
            cursor = page.nextCursor ?? undefined;
        }
        return allEvents.slice(0, count);
    },
    ["validatorsEpochEvents"],
    { revalidate: TTL_MS / 1000 }
);

export async function GET(request: NextRequest) {
    const datasetParam =
        request.nextUrl.searchParams.get("dataset") ?? "testnet";

    if (!(datasetParam in datasets))
        return new Response(JSON.stringify({ error: "Invalid dataset" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });

    const url = datasets[datasetParam];

    try {
        const t0 = Date.now();

        const [systemState, validatorsApy] = await Promise.all([
            fetchSystemState(url),
            fetchValidatorsApy(url),
        ]);
        console.log(
            `[validators] systemState+apy: ${Date.now() - t0}ms (${systemState.activeValidators.length} validators)`
        );

        const t1 = Date.now();
        const [validatorsGeo, epochInfoEvents] = await Promise.all([
            getValidatorLocalization(systemState.activeValidators),
            fetchEpochEvents(url, systemState.activeValidators.length),
        ]);
        console.log(
            `[validators] geo+events: ${Date.now() - t1}ms | total: ${Date.now() - t0}ms`
        );

        const apyByAddress = new Map(
            validatorsApy.apys.map((item) => [item.address, item.apy])
        );
        const geoByAddress = new Map(
            validatorsGeo.map((item) => [item.iotaAddress, item.geo])
        );
        const committeeMemberAddresses = new Set(
            systemState.committeeMembers.map((m) => m.iotaAddress)
        );
        const atRiskMap = new Map<string, string>(systemState.atRiskValidators);

        const responseData: ValidatorsApiResponseData = {
            systemState: {
                ...systemState,
                activeValidators: undefined,
                committeeMembers: undefined,
                atRiskValidators: undefined,
            },
            validators: systemState.activeValidators.map((validator) => ({
                iotaAddress: validator.iotaAddress,
                apy: apyByAddress.get(validator.iotaAddress) ?? null,
                geo: geoByAddress.get(validator.iotaAddress) ?? null,
                isCommitteeMember: committeeMemberAddresses.has(
                    validator.iotaAddress
                ),
                isAtRisk: atRiskMap.has(validator.iotaAddress),
                atRiskGracePeriod: atRiskMap.get(validator.iotaAddress) ?? null,
                payload: { ...validator, iotaAddress: undefined },
            })),
            epochInfoEvents,
            pendingActiveValidatorsSize:
                systemState.pendingActiveValidatorsSize,
        };

        return new Response(
            JSON.stringify({
                status: "success",
                ttl: TTL_MS,
                payload: responseData,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error fetching validators:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch validators" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
