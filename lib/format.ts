const NANO = 1_000_000_000;

export type IotaFormatResult = { value: string; label: string; raw: number };

export function formatNumber(n: number | null | undefined): IotaFormatResult {
    if (n === null || n === undefined) return { value: "—", label: "", raw: 0 };
    if (n >= 1_000_000_000)
        return { value: (n / 1_000_000_000).toFixed(2), label: "B", raw: n };
    if (n >= 1_000_000)
        return { value: (n / 1_000_000).toFixed(2), label: "M", raw: n };
    if (n >= 1_000)
        return { value: (n / 1_000).toFixed(1), label: "K", raw: n };
    return { value: String(n), label: "", raw: n };
}

export function formatIota(
    n: number | null | undefined,
    prefix = true,
    decimals = 2
): IotaFormatResult {
    if (n === null || n === undefined)
        return { value: "—", label: "IOTA", raw: 0 };
    const u = prefix ? " IOTA" : "";
    if (n >= 1_000_000_000) {
        return {
            value: (n / 1_000_000_000).toFixed(decimals),
            label: `B${u}`,
            raw: n,
        };
    }
    if (n >= 1_000_000) {
        return {
            value: (n / 1_000_000).toFixed(decimals),
            label: `M${u}`,
            raw: n,
        };
    }
    if (n >= 1_000) {
        return { value: (n / 1_000).toFixed(decimals), label: `K${u}`, raw: n };
    }
    return { value: n.toFixed(decimals), label: prefix ? "IOTA" : "", raw: n };
}

export function formatNanoToIota(
    nano: string | null | undefined,
    prefix = true,
    decimals = 2
): IotaFormatResult {
    if (!nano) return { value: "—", label: "", raw: 0 };
    return formatIota(Number(BigInt(nano)) / NANO, prefix, decimals);
}

export function formatIotaNano(
    nano: string | null | undefined
): IotaFormatResult {
    if (!nano) return { value: "—", label: "", raw: 0 };
    const n = Number(nano);
    return { value: n.toLocaleString(), label: "nanos", raw: n };
}

export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    if (ms <= 0) return "0s";
    const totalSecs = Math.floor(ms / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s >= 0 && d === 0) parts.push(`${s}s`);
    return parts.join(" ");
}

export function timeAgo(
    timestampMs: number | string | null | undefined,
    now: number
): IotaFormatResult {
    if (timestampMs === null || timestampMs === undefined)
        return { value: "—", label: "", raw: 0 };
    const ts = Number(timestampMs);
    const s = Math.floor(Math.max(0, now - ts) / 1000);
    if (s < 60) return { value: String(s), label: "s ago", raw: ts };
    const m = Math.floor(s / 60);
    if (m < 60) return { value: String(m), label: "m ago", raw: ts };
    return { value: String(Math.floor(m / 60)), label: "h ago", raw: ts };
}

export function formatTimestamp(
    ms: string | number | null | undefined,
    variant: "short" | "long" = "short"
): string {
    if (ms === null || ms === undefined || ms === "") return "—";
    const d = new Date(Number(ms));
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    if (variant === "short") return date;
    return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function shortString(s: string, head = 6, tail = 0): string {
    if (s.length <= head) return s;
    return s.slice(0, head) + "..." + (tail > 0 ? s.slice(-tail) : "");
}

export function formatTtl(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${ms / 1000}s`;
    return `${ms / 60_000}m`;
}

export function formatApy(apy: number | null | undefined): IotaFormatResult {
    if (apy == null) return { value: "—", label: "%", raw: 0 };
    return { value: apy.toFixed(2), label: "%", raw: apy };
}

export function formatCommissionRate(
    rate: number | null | undefined
): IotaFormatResult {
    if (rate == null) return { value: "—", label: "%", raw: 0 };
    const pct = rate / 100;
    return { value: pct.toFixed(2), label: "%", raw: pct };
}
