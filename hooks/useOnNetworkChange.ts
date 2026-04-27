"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext, useEffect, useEffectEvent } from "react";

export function useOnNetworkChange(callback: () => void) {
    const { network } = useContext(OptionsContext);
    const onNetworkChange = useEffectEvent(callback);

    useEffect(() => {
        onNetworkChange();
    }, [network]);
}
