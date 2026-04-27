"use client";

import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { SiteLink } from "@/components/SiteLink";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { formatIota, formatNanoToIota, shortString } from "@/lib/format";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function ValidatorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { isLoading, validators, selectedValidator, selectValidator } =
        useContext(ValidatorsContext);
    const router = useRouter();

    // Select from URL param only on initial load when nothing is selected yet
    useEffect(() => {
        if (selectedValidator || !validators.length) return;
        selectValidator?.(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validators.length]);

    // Sync URL when selected validator changes while on this page
    useEffect(() => {
        if (!selectedValidator) return;
        if (selectedValidator.iotaAddress !== id) {
            router.replace(`/validators/${selectedValidator.iotaAddress}`);
        }
    }, [selectedValidator?.iotaAddress]);

    useOnNetworkChange(() => {
        if (!isLoading && !selectedValidator) {
            router.push("/validators");
        }
    });

    if (!selectedValidator) {
        return (
            <Page>
                <div className="mx-auto pt-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        Click on globe marker
                    </p>
                    <span className="block py-4 text-sm text-muted-foreground">
                        or
                    </span>
                    <SiteLink
                        className="mb-3 gap-2 text-base text-foreground"
                        href="/validators"
                        arrowPosition="left"
                        arrowClassName="h-5 w-5"
                        label="Go back to validators list"
                    />
                </div>
            </Page>
        );
    }

    const validator = selectedValidator;

    const { payload, stats, iotaAddress, isCommitteeMember } = validator;

    const apyFormatted =
        stats.apyPercent != null ? `${stats.apyPercent.toFixed(2)}` : "—";
    const commission =
        payload.effectiveCommissionRate != null
            ? `${(Number(payload.effectiveCommissionRate) / 100).toFixed(2)}%`
            : "—";
    const votingPower =
        payload.votingPower != null
            ? `${(Number(payload.votingPower) / 100).toFixed(2)}`
            : "—";

    const totalStaked = formatNanoToIota(payload.stakingPoolIotaBalance);
    const rewardsPool = formatNanoToIota(payload.rewardsPool);
    const lastReward = formatIota(stats.lastEpochRewardIOTA);

    const nextEpochStake = formatNanoToIota(payload.nextEpochStake);
    const nextEpochCommission =
        payload.nextEpochCommissionRate != null
            ? `${(Number(payload.nextEpochCommissionRate) / 100).toFixed(2)}`
            : "—";

    return (
        <Page className="gap-4!">
            <SiteLink
                href="/validators"
                label="All validators"
                arrowPosition="left"
            />
            <div>
                <PageHeader
                    title={payload.name}
                    description={payload.description}
                    action={
                        isCommitteeMember && <Badge>Committee Member</Badge>
                    }
                    actionNearby
                />
                {payload.projectUrl && (
                    <SiteLink
                        className="mt-2 text-base"
                        href={validator.payload.projectUrl}
                        label={validator.payload.projectUrl?.replace(
                            /^https?:\/\//,
                            ""
                        )}
                        outerLink
                    />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Current Epoch</CardTitle>
                </CardHeader>
                <CardContent className="grid w-full grid-cols-2 items-center justify-center gap-4 @[25rem]:grid-cols-3 @[48rem]:grid-cols-5">
                    <Stat value={apyFormatted} label="APY" sub="%" />
                    <Stat value={commission} label="Commission" sub="%" />
                    <Stat value={votingPower} label="Voting Power" sub="%" />
                    <Stat
                        value={totalStaked.value}
                        sub={totalStaked.label}
                        label="Total Staked"
                    />
                    <Stat
                        value={rewardsPool.value}
                        sub={rewardsPool.label}
                        label="Rewards Pool"
                    />
                </CardContent>
            </Card>
            <div className="flex w-full gap-4 @max-[25rem]:flex-col">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Previous Epoch</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stat
                            value={lastReward?.value ?? "—"}
                            sub={lastReward?.label ?? rewardsPool.label}
                            label="Last Epoch Rewards"
                        />
                    </CardContent>
                </Card>

                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Previous Epoch</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 items-end gap-4 @[40rem]:grid-cols-2">
                        <Stat
                            value={nextEpochStake.value}
                            sub={nextEpochStake.label}
                            label="Next Epoch Stake"
                        />
                        <Stat
                            size={"sm"}
                            className="text-nowrap!"
                            value={nextEpochCommission}
                            label="Next Epoch Commission"
                        />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Identity</CardTitle>
                </CardHeader>
                <CardContent className="grid w-full grid-cols-1 gap-4 @[40rem]:grid-cols-3">
                    <Stat
                        value={shortString(iotaAddress, 4, 4)}
                        copyValue={iotaAddress}
                        size={"sm"}
                        label="iotaAddress"
                        withCopy
                    />
                    <Stat
                        value={shortString(payload.stakingPoolId, 4, 4)}
                        copyValue={payload.stakingPoolId}
                        size={"sm"}
                        label="Pool ID"
                        withCopy
                    />
                    <Stat
                        value={shortString(payload.protocolPubkeyBytes, 4, 4)}
                        copyValue={payload.protocolPubkeyBytes}
                        size={"sm"}
                        label="Protocol Public Key"
                        withCopy
                    />
                </CardContent>
            </Card>
        </Page>
    );
}
