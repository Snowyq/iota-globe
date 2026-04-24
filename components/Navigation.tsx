"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { cn } from "@/lib/utils";
import { Globe, Home, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useState } from "react";
import Logo from "./Logo";
import { Button } from "./ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/globe", label: "Globe", icon: Globe },
];

export default function Navigation() {
    const { network, selectNetwork } = useContext(OptionsContext);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    return (
        <header className="fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
            <nav className="flex h-(--nav-height) w-full max-w-6xl items-center gap-2 rounded-full border border-border/50 bg-background/60 px-4 shadow-lg shadow-black/10 backdrop-blur-md sm:px-5 xl:px-10">
                <Link
                    href="/"
                    className="mr-2 shrink-0"
                    onClick={() => setOpen(false)}
                >
                    <Logo />
                </Link>

                <div className="hidden items-center gap-1 md:flex">
                    {links.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                                pathname === href
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                        </Link>
                    ))}
                </div>

                <div className="flex-1" />

                <Select defaultValue={network} onValueChange={selectNetwork}>
                    <SelectTrigger
                        size="sm"
                        className="h-8 w-28 rounded-full border-border/50 text-xs"
                    >
                        <SelectValue placeholder="Network" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                        <SelectItem value="mainnet">Mainnet</SelectItem>
                        <SelectItem value="testnet">Testnet</SelectItem>
                        <SelectItem value="devnet">Devnet</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full md:hidden"
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? (
                        <X className="h-4 w-4" />
                    ) : (
                        <Menu className="h-4 w-4" />
                    )}
                </Button>
            </nav>

            {open && (
                <div className="absolute inset-x-4 top-16 rounded-2xl border border-border/50 bg-background/90 p-2 shadow-xl backdrop-blur-md sm:inset-x-5 md:hidden xl:inset-x-10">
                    {links.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setOpen(false)}
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-4 py-3 text-sm transition-colors",
                                pathname === href
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    ))}
                </div>
            )}
        </header>
    );
}
