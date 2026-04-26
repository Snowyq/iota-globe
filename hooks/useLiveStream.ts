"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext, useEffect, useRef } from "react";

export function useLiveStream<T>(path: string, onMessage: (item: T) => void) {
    const { network } = useContext(OptionsContext);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const es = new EventSource(`${path}?dataset=${network}`);
        es.onmessage = (e) => {
            try {
                onMessageRef.current(JSON.parse(e.data) as T);
            } catch {
                /* malformed frame */
            }
        };
        es.onerror = () => es.close();
        return () => es.close();
    }, [network, path]);
}
