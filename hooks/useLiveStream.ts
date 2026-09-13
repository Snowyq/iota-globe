"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext, useEffect, useEffectEvent, useState } from "react";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "waiting";

export function useLiveStream<T>(
    path: string | null,
    onMessage: (item: T) => void
) {
    const { network } = useContext(OptionsContext);
    const onMessageCallback = useEffectEvent(onMessage);
    const [status, setStatus] = useState<StreamStatus>("connecting");

    useEffect(() => {
        if (!path) return;
        let disposed = false;
        let lastMessageAt = 0;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus("connecting");
        const es = new EventSource(`${path}?dataset=${network}`);
        es.onmessage = (e) => {
            if (disposed) return;
            try {
                const item = JSON.parse(e.data) as T;
                onMessageCallback(item);
                lastMessageAt = Date.now();
                setStatus("live");
            } catch {
                console.error("Failed to parse SSE message", path);
            }
        };
        es.onerror = () => {
            if (!disposed) setStatus("reconnecting");
        };
        const timer = setInterval(() => {
            if (
                es.readyState === EventSource.OPEN &&
                Date.now() - lastMessageAt > 15_000
            )
                setStatus("waiting");
        }, 5_000);
        return () => {
            disposed = true;
            clearInterval(timer);
            es.onmessage = null;
            es.onerror = null;
            es.close();
        };
    }, [network, path]);
    return status;
}
