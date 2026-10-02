"use client";

import { useEffect, useState } from "react";

/** Current time, re-read every `intervalMs`. */
export function useNowTime(intervalMs = 1_000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    return now;
}
