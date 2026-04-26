const NANO = 1_000_000_000;

export type IotaFormatResult = { value: string; label: string };

export function formatNumber(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

export function formatIota(n: number, prefix = true): IotaFormatResult {
    const u = prefix ? " IOTA" : "";
    if (n >= 1_000_000_000) {
        return { value: (n / 1_000_000_000).toFixed(2), label: `B${u}` };
    }
    if (n >= 1_000_000) {
        return { value: (n / 1_000_000).toFixed(2), label: `M${u}` };
    }
    if (n >= 1_000) {
        return { value: (n / 1_000).toFixed(2), label: `K${u}` };
    }
    return { value: n.toFixed(2), label: prefix ? "IOTA" : "" };
}

export function formatNanoToIota(
    nano: string | null | undefined,
    prefix = true
): IotaFormatResult {
    if (!nano) return { value: "—", label: "" };
    return formatIota(Number(BigInt(nano)) / NANO, prefix);
}

export function formatIotaNano(
    nano: string | null | undefined
): IotaFormatResult {
    if (!nano) return { value: "—", label: "" };
    return { value: Number(nano).toLocaleString(), label: "nanos" };
}

export function formatDuration(ms: number): string {
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

export function timeAgo(timestampMs: number, now: number): string {
    const s = Math.floor(Math.max(0, now - timestampMs) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
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
    return s.slice(0, head) + "..." + (tail > 0 ? s.slice(-tail) : "");
}

export function formatTtl(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${ms / 1000}s`;
    return `${ms / 60_000}m`;
}
