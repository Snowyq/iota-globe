import { formatTtl } from "@/lib/format";
import { Badge } from "./ui/badge";

export function LiveBadge({
    ttl,
    className,
}: {
    ttl: number | null;
    className?: string;
}) {
    return (
        <Badge variant="outline">
            <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {ttl && formatTtl(ttl)}
        </Badge>
    );
}
