"use client";

import { Page } from "@/components/Page";
import { AddressesCard } from "@/features/network/AddressesCard";
import { EpochCard } from "@/features/network/EpochCard";
import NetworkActivityCard from "@/features/network/NetworkActivityCard";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { TpsCard } from "@/features/network/TpsCard";
import { ValidatorsCard } from "@/features/validators/ValidatorsCard";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function BottomCardsPortal() {
    const [container, setContainer] = useState<Element | null>(null);

    useEffect(() => {
        // only on mount
        // eslint-disable-next-line
        setContainer(document.getElementById("globe-bottom-portal"));
    }, []);

    if (!container) return null;

    return createPortal(
        <div className="pointer-events-auto flex flex-col gap-3 p-4 pl-3">
            <div className="flex w-full gap-3">
                <ValidatorsCard className="shrink-0 bg-card/50 backdrop-blur-sm" />
                <TpsCard className="flex-1 bg-card/50 backdrop-blur-sm" />
                <EpochCard className="w-fit shrink-0 border-2 border-primary bg-primary/30 shadow-lg shadow-primary backdrop-blur-md" />
            </div>
        </div>,
        container
    );
}

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
        <Page className="bg-transparent! backdrop-blur-none!">
            <EpochCard className="mb-8 w-full border-2 border-primary bg-primary/30 shadow-xl shadow-primary backdrop-blur-md @[25rem]:w-fit" />
            <div className="grid w-full grid-cols-1 gap-4 @[40rem]:grid-cols-2 @[64rem]:grid-cols-5">
                <TpsCard className="bg-card/50 backdrop-blur-sm @[40rem]:col-span-2 @[64rem]:col-span-3" />
                <ValidatorsCard className="@[64rem]:col-span-2" />
                <NetworkActivityCard className="@[64rem]:col-span-2" />
                <NetworkLiveCard className="@[40rem]:row-span-2 @[64rem]:col-span-3" />
                <AddressesCard className="@[64rem]:col-span-2" />
            </div>
        </Page>
    );
}
