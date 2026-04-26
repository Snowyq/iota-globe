import { Page } from "@/components/Page";
import { AddressesCard } from "@/features/network/AddressesCard";
import { EpochCard } from "@/features/network/EpochCard";
import { GasPriceCard } from "@/features/network/GasPriceCard";
import NetworkActivityCard from "@/features/network/NetworkActivityCard";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { TpsCard } from "@/features/network/TpsCard";
import { TransactionBlocksCard } from "@/features/network/TransactionBlocksCard";
import { ValidatorsCard } from "@/features/validators/ValidatorsCard";

export default function Index() {
    return (
        <Page className="bg-transparent! backdrop-blur-none!">
            <EpochCard className="mb-8 w-fit border-2 border-primary bg-primary/30 shadow-xl shadow-primary backdrop-blur-md" />
            <div className="grid w-full grid-cols-1 gap-4 @[40rem]:grid-cols-2 @[64rem]:grid-cols-5">
                <TpsCard className="bg-card/50 backdrop-blur-sm @[64rem]:col-span-3" />
                <ValidatorsCard className="@[64rem]:col-span-2" />
                <NetworkLiveCard className="@[64rem]:col-span-2 @[64rem]:row-span-2" />
                <NetworkActivityCard className="@[64rem]:col-span-2" />
                <GasPriceCard />
                <AddressesCard className="@[64rem]:col-span-2" />
                <TransactionBlocksCard className="@[64rem]:col-span-2" />
            </div>
        </Page>
    );
}
