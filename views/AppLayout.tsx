"use client";

import { BrandMark } from "@/components/Logo";
import { Ticker } from "@/components/Ticker";
import { OptionsContext } from "@/features/options/OptionsContext";
import { useContext } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { network } = useContext(OptionsContext);
    return (
        <div className="app-shell">
            <main id="main-content" className="main-content">
                {children}
            </main>
            <footer className="workspace-footer">
                <Ticker />
                <div className="colophon">
                    <span className="colophon-brand">
                        <BrandMark size={16} />
                        IOTA Globe
                    </span>
                    <span>
                        Reading IOTA {network} over JSON-RPC. Validator
                        locations are IP estimates; globe arcs are illustrative.
                    </span>
                    <a
                        href="https://docs.iota.org/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        IOTA docs ↗
                    </a>
                </div>
            </footer>
        </div>
    );
}
