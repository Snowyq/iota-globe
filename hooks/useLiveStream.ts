"use client";

import { useEffect, useState } from "react";

export function useLiveStream<T>(network: string, path: string) {
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
        setData(null);
        const es = new EventSource(`${path}?dataset=${network}`);
        es.onmessage = (e) => {
            try {
                setData(JSON.parse(e.data) as T);
            } catch { /* malformed frame */ }
        };
        es.onerror = () => es.close();
        return () => es.close();
    }, [network, path]);

    return data;
}
