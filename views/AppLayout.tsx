"use client";

import { BrandMark } from "@/components/Logo";
import { OptionsContext } from "@/features/options/OptionsContext";
import { usePathname } from "next/navigation";
import { useContext } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { network } = useContext(OptionsContext);
    // The overview and the about page run edge to edge; every other page
    // sits in the column.
    const pathname = usePathname();
    const stage = pathname === "/" || pathname === "/about";
    return (
        <div className="app-shell">
            <main
                id="main-content"
                className={`main-content ${stage ? "is-stage" : ""}`}
            >
                {children}
            </main>
            {/* The about page closes on its own footer. */}
            {pathname !== "/about" && (
                <footer className="workspace-footer">
                    <div className="colophon">
                        <span className="colophon-brand">
                            <BrandMark size={16} />
                            IOTA Globe
                        </span>
                        <span>
                            Reading IOTA {network} over JSON-RPC. Validator
                            locations are IP estimates; globe arcs are
                            illustrative.
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
            )}
        </div>
    );
}
