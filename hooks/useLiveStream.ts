"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext, useEffect, useEffectEvent } from "react";

export function useLiveStream<T>(
    path: string | null,
    onMessage: (item: T) => void
) {
    const { network } = useContext(OptionsContext);
    const onMessageCallback = useEffectEvent(onMessage);

    useEffect(() => {
        if (!path) return;
        const es = new EventSource(`${path}?dataset=${network}`);
        es.onmessage = (e) => {
            try {
                onMessageCallback(JSON.parse(e.data) as T);
            } catch {
                console.error("Failed to parse SSE message", path);
            }
        };
        es.onerror = () => es.close();
        return () => es.close();
    }, [network, path]);
}
