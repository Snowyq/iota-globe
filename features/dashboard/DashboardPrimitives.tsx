"use client";

import { SkeletonBlock } from "@/components/Loading";
import { ArrowUpRight, Radio, WifiOff } from "lucide-react";
import Link from "next/link";
import type { StreamStatus } from "@/hooks/useLiveStream";
import { cn } from "@/lib/utils";

export function Panel({
    children,
    className,
    ...props
}: React.ComponentProps<"section">) {
    return (
        <section className={cn("panel", className)} {...props}>
            {children}
        </section>
    );
}
export function PanelHeader({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="panel-heading">
            <div>
                <h2>{title}</h2>
                {description && <p>{description}</p>}
            </div>
            {action}
        </div>
    );
}
export function TextLink({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <Link className="text-link" href={href}>
            {children}
            <ArrowUpRight size={14} />
        </Link>
    );
}
export function Metric({
    label,
    value,
    unit,
    detail,
    isLoading = false,
}: {
    label: string;
    value: React.ReactNode;
    unit?: string;
    detail: React.ReactNode;
    isLoading?: boolean;
}) {
    return (
        <div className="metric-card" aria-busy={isLoading}>
            <span className="metric-label">{label}</span>
            <div className="metric-value">
                {isLoading ? (
                    <>
                        <SkeletonBlock className="skeleton-metric-value" />
                        <span className="sr-only">
                            Loading {label.toLowerCase()}
                        </span>
                    </>
                ) : (
                    <>
                        {value ?? "—"}
                        {unit && <span>{unit}</span>}
                    </>
                )}
            </div>
            <div className="metric-detail">
                {isLoading ? (
                    <SkeletonBlock className="skeleton-metric-detail" />
                ) : (
                    detail
                )}
            </div>
        </div>
    );
}
export function StreamBadge({ status }: { status: StreamStatus }) {
    return (
        <span
            className={`stream-badge ${status === "live" ? "is-live" : ""}`}
            role="status"
        >
            <span
                className={`status-dot ${status === "live" ? "" : "is-muted"}`}
            />
            {status === "live"
                ? "Live"
                : status === "connecting"
                  ? "Connecting"
                  : status === "waiting"
                    ? "Awaiting activity"
                    : "Reconnecting"}
        </span>
    );
}
export function EmptyState({
    title = "Waiting for network data",
    description = "Data will appear here as soon as the network responds.",
    error = false,
    action,
}: {
    title?: string;
    description?: string;
    error?: boolean;
    action?: React.ReactNode;
}) {
    const Icon = error ? WifiOff : Radio;
    return (
        <div className="empty-state">
            <span>
                <Icon size={22} strokeWidth={1.3} />
            </span>
            <strong>{title}</strong>
            <p>{description}</p>
            {action}
        </div>
    );
}
export function RetryButton({
    onClick,
    retrying,
    label = "Retry",
    className,
}: {
    onClick: () => void;
    retrying?: boolean;
    label?: string;
    className?: string;
}) {
    return (
        <button
            className={cn("subtle-button", className)}
            disabled={retrying}
            onClick={onClick}
        >
            {retrying ? "Retrying…" : label}
        </button>
    );
}
export function ErrorBanner({
    children,
    onRetry,
    retrying,
    retryLabel,
    role = "status",
    icon = true,
}: {
    children: React.ReactNode;
    onRetry: () => void;
    retrying?: boolean;
    retryLabel?: string;
    role?: "status" | "alert";
    icon?: boolean;
}) {
    return (
        <div className="error-banner" role={role}>
            {icon && <WifiOff size={16} />}
            <span>{children}</span>
            <RetryButton
                className="ml-auto"
                onClick={onRetry}
                retrying={retrying}
                label={retryLabel}
            />
        </div>
    );
}
export function compact(
    value: string | number | null | undefined,
    decimals = 2
) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: decimals,
    }).format(Number(value));
}
export function nano(value: string | null | undefined) {
    return value == null ? null : Number(value) / 1e9;
}
