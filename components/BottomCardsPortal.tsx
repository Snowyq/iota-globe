"use client";

import { EpochCard } from "@/features/network/EpochCard";
import { TpsCard } from "@/features/network/TpsCard";
import { ValidatorsCard } from "@/features/validators/ValidatorsCard";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function BottomCardsPortal() {
    const [container, setContainer] = useState<Element | null>(null);

    useEffect(() => {
        // only on mount search for target el
        // eslint-disable-next-line
        setContainer(document.getElementById("globe-bottom-portal"));
    }, []);

    if (!container) return null;

    return createPortal(
        <div className="pointer-events-auto flex flex-col gap-3 p-4 pl-3">
            <div className="flex w-full gap-3">
                <ValidatorsCard className="shrink-0 bg-card/50 backdrop-blur-sm" />
                <TpsCard className="flex-1 bg-card/50 backdrop-blur-sm" />
                <EpochCard className="w-fit shrink-0" />
            </div>
        </div>,
        container
    );
}
