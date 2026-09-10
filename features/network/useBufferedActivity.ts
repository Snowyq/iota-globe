"use client";

import { useCallback, useState } from "react";

export function useBufferedActivity<T>(keyOf: (item: T) => string) {
    const [feed, setFeed] = useState<{
        items: T[];
        snapshot: T[] | null;
        unread: number;
    }>({ items: [], snapshot: null, unread: 0 });
    const push = useCallback(
        (item: T) =>
            setFeed((previous) => {
                const key = keyOf(item);
                if (
                    previous.items.some((value) => keyOf(value) === key) ||
                    previous.snapshot?.some((value) => keyOf(value) === key)
                )
                    return previous;
                return {
                    ...previous,
                    items: [item, ...previous.items].slice(0, 20),
                    unread: previous.snapshot ? previous.unread + 1 : 0,
                };
            }),
        [keyOf]
    );
    const hold = useCallback(
        () =>
            setFeed((previous) =>
                previous.snapshot
                    ? previous
                    : { ...previous, snapshot: previous.items }
            ),
        []
    );
    const resume = useCallback(
        () =>
            setFeed((previous) => ({ ...previous, snapshot: null, unread: 0 })),
        []
    );
    const reset = useCallback(
        () => setFeed({ items: [], snapshot: null, unread: 0 }),
        []
    );
    return {
        items: feed.snapshot ?? feed.items,
        unread: feed.unread,
        paused: feed.snapshot !== null,
        push,
        hold,
        resume,
        reset,
    };
}
