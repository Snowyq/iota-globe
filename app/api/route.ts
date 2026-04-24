import { cachedFetch } from "@/lib/cache";
import { getValidatorLocalization } from "@/lib/localizeValidators";
import { IotaClient } from "@iota/iota-sdk/client";
import { type NextRequest } from "next/server";

const VALIDATOR_EPOCH_INFO_EVENT =
    "0x3::validator_set::ValidatorEpochInfoEventV1";
const MAX_EVENTS_PER_PAGE = 50;
const TTL_CHAIN = 30_000;
const TTL_GEO = 24 * 60 * 60_000;

const datasets = {
    mainnet: "https://rpc.ankr.com/iota_mainnet",
    testnet: "https://rpc.ankr.com/iota_testnet",
};

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
    payload: Omit<Validator, "iotaAddress"> & {
        iotaAddress?: undefined;
    };
};

export type IotaApiResponseData = {
    systemState: ApiSystemState;
    validators: ValidatorResponseItem[];
    epochInfoEvents: EpochInfoEvent[];
};

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const datasetParam = searchParams.get("dataset") ?? "testnet";

    if (!(datasetParam in datasets)) {
        return new Response(JSON.stringify({ error: "Invalid dataset" }), {
            status: 400,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    const iotaClient = new IotaClient({
        url: datasets[datasetParam as keyof typeof datasets],
    });

    try {
        const [systemState, validatorsApy] = await Promise.all([
            cachedFetch(`systemState:${datasetParam}`, TTL_CHAIN, () =>
                iotaClient.getLatestIotaSystemState()
            ),
            cachedFetch(`validatorsApy:${datasetParam}`, TTL_CHAIN, () =>
                iotaClient.getValidatorsApy()
            ),
        ]);

        const [validatorsGeo, epochInfoEvents] = await Promise.all([
            cachedFetch(`validatorsGeo:${datasetParam}`, TTL_GEO, () =>
                getValidatorLocalization(systemState.activeValidators)
            ),
            cachedFetch(`epochInfoEvents:${datasetParam}`, TTL_CHAIN, () =>
                getEpochInfoEvents(
                    iotaClient,
                    systemState.activeValidators.length
                )
            ),
        ]);

        const apyByAddress = new Map(
            validatorsApy.apys.map((item) => [item.address, item.apy])
        );
        const geoByAddress = new Map(
            validatorsGeo.map((item) => [item.iotaAddress, item.geo])
        );
        const committeeMemberAddresses = new Set(
            systemState.committeeMembers.map((member) => member.iotaAddress)
        );

        const responseData: IotaApiResponseData = {
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
                payload: {
                    ...validator,
                    iotaAddress: undefined,
                },
            })),
            epochInfoEvents,
        };

        return new Response(
            JSON.stringify({ status: "success", payload: responseData }),
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
        console.error("Error fetching data from IOTA client:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch data from IOTA client" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }

    //   return new Response(JSON.stringify(state), {
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //   })
}

async function getEpochInfoEvents(client: IotaClient, items: number) {
    const allEvents: EpochInfoEvent[] = [];
    let cursor = undefined;
    for (let i = 0; allEvents.length < items && i < 5; i++) {
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
    return allEvents.slice(0, items);
}
