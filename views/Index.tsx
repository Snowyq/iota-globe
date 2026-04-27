import { BottomCardsPortal } from "@/components/BottomCardsPortal";
import { Page } from "@/components/Page";
import { AddressesCard } from "@/features/network/AddressesCard";
import { EpochCard } from "@/features/network/EpochCard";
import NetworkActivityCard from "@/features/network/NetworkActivityCard";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { TpsCard } from "@/features/network/TpsCard";
import { ValidatorsCard } from "@/features/validators/ValidatorsCard";

export function IndexFullscreenPanel() {
    return (
        <>
            <div className="flex h-full flex-col justify-end gap-3 p-4 pr-0">
                <NetworkLiveCard className="max-h-none min-h-0 flex-1 bg-card/50 backdrop-blur-sm" />
                <AddressesCard className="shrink-0 bg-card/50 backdrop-blur-sm" />
                <NetworkActivityCard className="shrink-0 bg-card/50 backdrop-blur-sm" />
            </div>
            <BottomCardsPortal />
        </>
    );
}

export default function Index() {
    return (
        <Page className="gap-0! bg-transparent! backdrop-blur-none!">
            <EpochCard className="mb-4 w-full @[40rem]:w-fit" />
            <div className="grid w-full grid-cols-1 gap-4 @[40rem]:grid-cols-2 @[64rem]:grid-cols-5">
                <TpsCard className="bg-card/50 backdrop-blur-sm @[40rem]:col-span-2 @[64rem]:col-span-5" />
                <NetworkActivityCard className="@[64rem]:col-span-2" />
                <ValidatorsCard className="@[64rem]:col-span-2" />
                <AddressesCard className="@[64rem]:col-span-2" />
                <NetworkLiveCard className="h-120 @[40rem]:row-span-3 @[40rem]:row-start-2 @[40rem]:h-150 @[64rem]:col-span-3" />
            </div>
        </Page>
    );
}
