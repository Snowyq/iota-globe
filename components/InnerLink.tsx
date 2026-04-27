import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function InnerLink({
    href,
    label,
    className,
    outerLink = false,
}: {
    href: string;
    label: string;
    className?: string;
    outerLink?: boolean;
}) {
    const Tag = outerLink ? "a" : Link;

    return (
        <Tag
            href={href}
            className={cn(
                "flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
                className
            )}
        >
            {label} <ArrowUpRight className="h-3 w-3" />
        </Tag>
    );
}
