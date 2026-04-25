import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type FormattedCellProps = {
    value: React.ReactNode;
    label?: string;
    align?: "left" | "center" | "right";
    labelPosition?: "top" | "bottom" | "left" | "right";
    className?: string;
};

export function FormattedCell({
    value,
    label,
    align = "left",
    labelPosition = "right",
    className,
}: FormattedCellProps) {
    return (
        <TableCell
            className={cn(
                "tabular-nums",
                align === "center" && "text-center",
                align === "right" && "text-right",
                className
            )}
        >
            <div
                className={cn(
                    "flex",
                    labelPosition === "top" && "flex-col-reverse",
                    labelPosition === "bottom" && "flex-col gap-1",
                    labelPosition === "left" &&
                        "flex-row-reverse items-baseline gap-2",
                    labelPosition === "right" &&
                        "flex-row items-baseline gap-2",
                    align === "center" && "justify-center",
                    align === "right" && "justify-end"
                )}
            >
                <span className="text-sm">{value ?? "—"}</span>
                {label && (
                    <span className="text-xs text-muted-foreground">
                        {label}
                    </span>
                )}
            </div>
        </TableCell>
    );
}
