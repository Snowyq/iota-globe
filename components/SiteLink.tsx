import { cn } from "@/lib/utils";
import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function SiteLink({
    href,
    label,
    className,
    outerLink = false,
    arrowPosition = "right",
    arrowClassName,
}: {
    href: string;
    label: string;
    className?: string;
    outerLink?: boolean;
    arrowClassName?: string;
    arrowPosition?: "right" | "left";
}) {
    const Tag = outerLink ? "a" : Link;

    return (
        <Tag
            href={href}
            className={cn(
                "flex w-fit items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
                className
            )}
        >
            {arrowPosition === "left" && (
                <ArrowUpLeft className={cn("h-3 w-3", arrowClassName)} />
            )}
            {label}
            {arrowPosition === "right" && (
                <ArrowUpRight className={cn("h-3 w-3", arrowClassName)} />
            )}
        </Tag>
    );
}
