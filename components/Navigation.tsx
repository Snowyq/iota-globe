"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import {
    Activity,
    ArrowUpRight,
    Command,
    ExternalLink,
    Globe2,
    Layers3,
    LayoutDashboard,
    Menu,
    ShieldCheck,
    X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { NetworkSelect } from "./NetworkSelect";

const links = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/validators", label: "Validators", icon: ShieldCheck },
    { href: "/transactions", label: "Transactions", icon: Activity },
    { href: "/epochs", label: "Epoch history", icon: Layers3 },
];

export default function Navigation() {
    const { network, selectNetwork } = useContext(OptionsContext);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const layerRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const query = window.matchMedia("(max-width: 680px)");
        const update = () => {
            setIsMobile(query.matches);
            if (!query.matches) setOpen(false);
        };
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    useEffect(() => {
        if (!isMobile) return;
        const viewport = window.visualViewport;
        const update = () => {
            const offset = viewport?.offsetTop ?? 0;
            const top = Math.max(
                offset,
                barRef.current?.getBoundingClientRect().bottom ?? 62
            );
            const height = Math.max(
                0,
                (viewport?.height ?? window.innerHeight) - (top - offset) - 8
            );
            const pageTop =
                (viewport?.pageTop ?? window.scrollY) + top - offset;
            layerRef.current?.style.setProperty(
                "--navigation-top",
                `${pageTop}px`
            );
            layerRef.current?.style.setProperty(
                "--navigation-height",
                `${height}px`
            );
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        viewport?.addEventListener("resize", update);
        viewport?.addEventListener("scroll", update);
        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            viewport?.removeEventListener("resize", update);
            viewport?.removeEventListener("scroll", update);
        };
    }, [isMobile, open]);
    useEffect(() => {
        if (!open || !isMobile) return;
        const toggle = toggleRef.current;
        const focusable = () => [
            toggleRef.current!,
            ...sidebarRef.current!.querySelectorAll<HTMLElement>(
                "a[href]:not(.desktop-brand), button:not(:disabled), select:not(:disabled)"
            ),
        ];
        // Keep the existing page scroll position and Safari viewport intact.
        focusable()[1]?.focus({ preventScroll: true });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
            }
            if (event.key !== "Tab") return;
            const nodes = focusable();
            const index = nodes.indexOf(document.activeElement as HTMLElement);
            if (event.shiftKey && index <= 0) {
                event.preventDefault();
                nodes.at(-1)?.focus();
            } else if (
                !event.shiftKey &&
                (index === -1 || index === nodes.length - 1)
            ) {
                event.preventDefault();
                nodes[0]?.focus();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            if (window.matchMedia("(max-width: 680px)").matches)
                toggle?.focus({ preventScroll: true });
        };
    }, [open, isMobile]);
    return (
        <>
            <div className="mobile-bar" ref={barRef}>
                <Link href="/" className="brand" onClick={() => setOpen(false)}>
                    <span className="brand-symbol">
                        <Globe2 />
                    </span>
                    IOTA<span>Globe</span>
                </Link>
                <button
                    ref={toggleRef}
                    className="icon-button"
                    aria-label={open ? "Close navigation" : "Open navigation"}
                    aria-expanded={open}
                    aria-controls="site-nav"
                    onClick={() => setOpen(!open)}
                >
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>
            <div className="navigation-layer" ref={layerRef}>
                {open && (
                    <button
                        className="nav-backdrop"
                        aria-label="Close navigation"
                        tabIndex={-1}
                        onClick={() => setOpen(false)}
                    />
                )}
                <aside
                    ref={sidebarRef}
                    id="site-nav"
                    inert={isMobile && !open}
                    className={`sidebar ${open ? "is-open" : ""}`}
                >
                    <Link
                        href="/"
                        className="brand desktop-brand"
                        tabIndex={isMobile ? -1 : undefined}
                        onClick={() => setOpen(false)}
                    >
                        <span className="brand-symbol">
                            <Globe2 size={23} strokeWidth={1.5} />
                        </span>
                        IOTA<span>Globe</span>
                    </Link>
                    <div className="network-picker">
                        <label htmlFor="network-select">Network</label>
                        <NetworkSelect
                            value={network}
                            onChange={(value) => selectNetwork?.(value)}
                            disabled={isMobile && !open}
                        />
                    </div>
                    <div className="nav-group-label">Explore network</div>
                    <nav aria-label="Main navigation" className="sidebar-links">
                        {links.map(({ href, label, icon: Icon }) => {
                            const active =
                                href === "/"
                                    ? pathname === href
                                    : pathname.startsWith(href);
                            return (
                                <Link
                                    href={href}
                                    key={href}
                                    className={active ? "active" : ""}
                                    aria-current={active ? "page" : undefined}
                                    onClick={() => setOpen(false)}
                                >
                                    <Icon size={18} strokeWidth={1.6} />
                                    <span>{label}</span>
                                    {active && (
                                        <span className="nav-active-dot" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="sidebar-bottom">
                        <div className="sidebar-note">
                            <span className="note-orbit">
                                <Globe2 size={23} />
                            </span>
                            <h2>A network without borders.</h2>
                            <p>Discover the people and activity behind IOTA.</p>
                            <a
                                href="https://www.iota.org/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Discover IOTA <ArrowUpRight size={14} />
                            </a>
                        </div>
                        <a
                            className="resource-link"
                            href="https://docs.iota.org/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Command size={15} /> Documentation{" "}
                            <ExternalLink size={13} />
                        </a>
                        <div className="sidebar-signature">
                            <span className="mini-iota">ı</span>
                            <span>Built to explore.</span>
                            <span className="version-tag">v2.0</span>
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
}
