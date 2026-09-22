"use client";

import type { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { useLiveStream, type StreamStatus } from "@/hooks/useLiveStream";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

// A couple of minutes at mainnet's pace, enough for one-minute aggregates.
const KEEP = 2_400;
// Transactions arrive ~30 a second. Folding them in four times a second
// keeps everything that shows them calm and costs a handful of renders.
const FLUSH_MS = 250;

type TransactionData = {
    // Newest first.
    transactions: TransactionStreamItem[];
    status: StreamStatus;
};

const TransactionDataContext = createContext<TransactionData>({
    transactions: [],
    status: "connecting",
});

export function TransactionStreamProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [transactions, setTransactions] = useState<TransactionStreamItem[]>(
        []
    );
    const pending = useRef<TransactionStreamItem[]>([]);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flush = useCallback(() => {
        timer.current = null;
        const incoming = pending.current;
        pending.current = [];
        if (!incoming.length) return;
        setTransactions((previous) => {
            const known = new Set(previous.slice(0, 400).map((t) => t.digest));
            const fresh = incoming.filter((t) => {
                if (known.has(t.digest)) return false;
                known.add(t.digest);
                return true;
            });
            if (!fresh.length) return previous;
            // The stream sends oldest first; the list keeps newest first.
            return [...fresh.reverse(), ...previous].slice(0, KEEP);
        });
    }, []);
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );
    useOnNetworkChange(() => {
        pending.current = [];
        setTransactions([]);
    });
    const push = useCallback(
        (item: TransactionStreamItem) => {
            pending.current.push(item);
            if (pending.current.length > KEEP)
                pending.current = pending.current.slice(-KEEP);
            timer.current ??= setTimeout(flush, FLUSH_MS);
        },
        [flush]
    );
    const status = useLiveStream<TransactionStreamItem>(
        "/api/transactions/stream",
        push
    );
    const value = useMemo(
        () => ({ transactions, status }),
        [transactions, status]
    );
    return (
        <TransactionDataContext.Provider value={value}>
            {children}
        </TransactionDataContext.Provider>
    );
}

export const useTransactionStream = () => useContext(TransactionDataContext);

export type TransactionMix = {
    count: number;
    // Seconds of chain the sample covers (up to the window).
    spanSeconds: number;
    perMinute: number | null;
    user: number;
    system: number;
    gasIOTA: number;
    medianGas: number | null;
    meanOps: number | null;
    senders: number;
    // Programmable transactions by number of commands.
    ops: { label: string; count: number }[];
};

const OPS_BUCKETS = [
    { label: "1", max: 1 },
    { label: "2", max: 2 },
    { label: "3–5", max: 5 },
    { label: "6–10", max: 10 },
    { label: "11+", max: Infinity },
];

// What the last minute of transactions was made of, measured on chain
// time from the newest one seen.
export function mixFrom(
    transactions: TransactionStreamItem[],
    windowMs = 60_000
): TransactionMix {
    const newest = Number(transactions[0]?.timestampMs ?? 0);
    const recent = transactions.filter(
        (t) => newest - Number(t.timestampMs ?? 0) <= windowMs
    );
    const oldest = Number(recent.at(-1)?.timestampMs ?? newest);
    const spanMinutes = (newest - oldest) / 60_000;
    const user = recent.filter((t) => !t.isSystem);
    const gas = user.map((t) => t.gasIOTA).sort((a, b) => a - b);
    const withOps = user.filter((t) => t.txnsCount != null);
    return {
        count: recent.length,
        spanSeconds: (newest - oldest) / 1000,
        perMinute: spanMinutes > 0.05 ? recent.length / spanMinutes : null,
        user: user.length,
        system: recent.length - user.length,
        gasIOTA: gas.reduce((a, b) => a + b, 0),
        medianGas: gas.length ? gas[gas.length >> 1] : null,
        meanOps: withOps.length
            ? withOps.reduce((s, t) => s + (t.txnsCount ?? 0), 0) /
              withOps.length
            : null,
        senders: new Set(user.map((t) => t.sender)).size,
        ops: OPS_BUCKETS.map((bucket, i) => ({
            label: bucket.label,
            count: withOps.filter(
                (t) =>
                    (t.txnsCount ?? 0) <= bucket.max &&
                    (t.txnsCount ?? 0) > (OPS_BUCKETS[i - 1]?.max ?? 0)
            ).length,
        })),
    };
}
