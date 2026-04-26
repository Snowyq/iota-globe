"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext, useEffect, useRef } from "react";

export function useOnNetworkChange(callback: () => void) {
    const { network } = useContext(OptionsContext);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        callbackRef.current();
    }, [network]);
}
