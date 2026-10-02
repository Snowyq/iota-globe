"use client";

import { NetworkContext } from "@/features/network/NetworkContext";
import { useCheckpointStream } from "@/features/network/CheckpointStream";
import { OptionsContext } from "@/features/options/OptionsContext";
import { useNowTime } from "@/hooks/useNowTime";
import { Activity, Globe2, Info, Layers3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import Logo, { BrandMark } from "./Logo";
import { NetworkSelect } from "./NetworkSelect";

const links = [
    { href: "/", label: "Overview", short: "Overview", icon: Globe2 },
    {
        href: "/validators",
        label: "Validators",
        short: "Validators",
        icon: ShieldCheck,
    },
    {
        href: "/transactions",
        label: "Transactions",
        short: "Txs",
        icon: Activity,
    },
    { href: "/epochs", label: "Epochs", short: "Epochs", icon: Layers3 },
    { href: "/about", label: "About", short: "About", icon: Info },
];

const isActive = (pathname: string, href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

function UtcClock() {
    const now = useNowTime();
    const time = new Date(now).toISOString().slice(11, 19);
    return (
        <time
            className="utc-clock"
            dateTime={new Date(now).toISOString()}
            suppressHydrationWarning
        >
            <span suppressHydrationWarning>{time}</span> UTC
        </time>
    );
}

export function ConnectionReadout() {
    const { error, isLoading, updatedAt, networkMetrics } =
        useContext(NetworkContext);
    const state = error
        ? "offline"
        : updatedAt
          ? "live"
          : isLoading
            ? "connecting"
            : "offline";
    const { blocks } = useCheckpointStream();
    // Streamed head first, the polled snapshot as a fallback.
    const checkpoint =
        blocks[0]?.sequenceNumber ?? networkMetrics?.currentCheckpoint;
    return (
        <span className={`connection-readout is-${state}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            <span className="connection-label">
                {state === "live"
                    ? "Live"
                    : state === "connecting"
                      ? "Connecting"
                      : error
                        ? "Interrupted"
                        : "No data"}
            </span>
            {state === "live" && checkpoint && (
                <span className="connection-checkpoint">
                    CP {Number(checkpoint).toLocaleString("en-US")}
                </span>
            )}
        </span>
    );
}

export default function Navigation() {
    const { network, selectNetwork } = useContext(OptionsContext);
    const pathname = usePathname();
    return (
        <>
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>
            <header className="topbar">
                <Link href="/" className="brand" aria-label="IOTA Globe home">
                    <BrandMark />
                    <Logo />
                </Link>
                <nav aria-label="Main navigation" className="topnav">
                    {links.map(({ href, label }) => {
                        const active = isActive(pathname, href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={active ? "active" : undefined}
                                aria-current={active ? "page" : undefined}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="topbar-status">
                    <ConnectionReadout />
                    <UtcClock />
                    <NetworkSelect
                        value={network}
                        onChange={(value) => selectNetwork?.(value)}
                    />
                </div>
            </header>
            <nav aria-label="Main navigation" className="tabbar">
                {links.map(({ href, short, icon: Icon }) => {
                    const active = isActive(pathname, href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={active ? "active" : undefined}
                            aria-current={active ? "page" : undefined}
                        >
                            <Icon
                                size={19}
                                strokeWidth={1.6}
                                aria-hidden="true"
                            />
                            <span>{short}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
