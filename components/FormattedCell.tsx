import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Table cell showing a value with a small unit after it. */
export function FormattedCell({
    value,
    label,
    align = "left",
    className,
    dataLabel,
}: {
    value: React.ReactNode;
    label?: string;
    align?: "left" | "center" | "right";
    className?: string;
    dataLabel?: string;
}) {
    const empty = value == null || (typeof value === "number" && isNaN(value));
    return (
        <TableCell
            data-label={dataLabel}
            className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                className
            )}
        >
            <div className="flex flex-col gap-0">
                <div
                    className={cn(
                        "flex items-baseline gap-1",
                        align === "center" && "justify-center",
                        align === "right" && "justify-end"
                    )}
                >
                    <span className="text-base font-medium tabular-nums">
                        {empty ? "—" : value}
                    </span>
                    {label && (
                        <span className="text-[10px] text-muted-foreground">
                            {label}
                        </span>
                    )}
                </div>
            </div>
        </TableCell>
    );
}
