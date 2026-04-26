"use client";

import { useEffect, useState } from "react";

type Interval = number | "seconds" | "minutes";

function resolveMs(interval: Interval): number {
    if (interval === "seconds") return 1_000;
    if (interval === "minutes") return 60_000;
    return interval;
}

export function useNowTime(interval: Interval = "seconds"): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), resolveMs(interval));
        return () => clearInterval(id);
    }, [interval]);

    return now;
}
