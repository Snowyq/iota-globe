"use client";

import { NetworkContext } from "@/features/network/NetworkContext";
import { OptionsContext } from "@/features/options/OptionsContext";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { Radio } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { network } = useContext(OptionsContext);
    const { error, isLoading, updatedAt } = useContext(NetworkContext);
    const section = pathname.startsWith("/validators")
        ? "Validators"
        : pathname === "/transactions"
          ? "Transactions"
          : pathname === "/epochs"
            ? "Epoch history"
            : "Overview";

    return (
        <div className="app-shell">
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>
            <header className="workspace-header">
                <div className="breadcrumb">
                    <span>Workspace</span>
                    <span className="text-border">/</span>
                    <span>{section}</span>
                </div>
                <div
                    className={`connection-status ${error ? "is-offline" : ""}`}
                    role="status"
                >
                    <span
                        className={`status-dot ${!updatedAt || error ? "is-muted" : ""}`}
                    />
                    <span>
                        {error
                            ? "Connection interrupted"
                            : isLoading
                              ? "Connecting to network"
                              : updatedAt
                                ? "Network connected"
                                : "Data unavailable"}
                    </span>
                    <span className="header-network">{network}</span>
                </div>
            </header>
            <main id="main-content" className="main-content">
                {children}
            </main>
            <footer className="workspace-footer">
                <span>
                    <Radio size={13} /> IOTA Globe{" "}
                    <span className="text-muted-foreground">
                        / Network observatory
                    </span>
                </span>
                <span>
                    Powered by IOTA <span className="footer-separator">·</span>{" "}
                    On-chain data
                </span>
            </footer>
        </div>
    );
}
