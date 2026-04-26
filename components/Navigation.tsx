"use client";

import { OptionsContext } from "@/features/options/OptionsContext";
import { cn } from "@/lib/utils";
import {
    ArrowLeftRight,
    Clock,
    Compass,
    Globe,
    Home,
    Menu,
    X,
} from "lucide-react";
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
    { href: "/validators", label: "Validators", icon: Globe },
    { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
    { href: "/epochs", label: "Epochs", icon: Clock },
    { href: "/explore", label: "Explore", icon: Compass },
];

export default function Navigation() {
    const { network, selectNetwork, isFullscreen } = useContext(OptionsContext);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    return (
        <header
            className={cn(
                "fixed inset-x-2 top-0 z-50 flex justify-center transition-[padding] duration-500 ease-in-out",
                isFullscreen ? "pt-0" : "pt-2"
            )}
        >
            <nav
                className={cn(
                    "flex h-(--nav-height) w-full items-center gap-2 border border-border/50 bg-background/60 px-4 shadow-lg shadow-black/10 backdrop-blur-md transition-[max-width,border-radius] duration-500 ease-in-out sm:px-5 xl:px-10",
                    isFullscreen
                        ? "max-w-full rounded-none"
                        : "max-w-6xl rounded-full"
                )}
            >
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
                                    ? "border-2 border-primary bg-primary/30 shadow-lg shadow-primary backdrop-blur-md"
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
