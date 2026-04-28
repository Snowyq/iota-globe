import { cn } from "@/lib/utils";
import { TableCell } from "./ui/table";

export type TableHeaderCellProps = {
    label: string;
    align?: "left" | "center" | "right";
    icon?: React.ComponentType<{ className?: string }>;
    iconActive?: boolean;
    onClick?: () => void;
    className?: string;
};

export function TableHeaderCell({
    label,
    align,
    icon: Icon,
    iconActive,
    onClick,
    className,
}: TableHeaderCellProps) {
    return (
        <TableCell
            onClick={onClick}
            className={cn(
                "text-wrap! text-xs text-muted-foreground",
                align === "center" && "text-center",
                align === "right" && "text-right",
                onClick && "cursor-pointer select-none",
                className
            )}
        >
            {Icon ? (
                <span
                    className={cn(
                        "flex items-center gap-1",
                        align === "center" && "justify-center",
                        align === "right" && "justify-end"
                    )}
                >
                    {label}
                    <Icon
                        className={cn(
                            "h-3 w-3 shrink-0",
                            iconActive ? "text-foreground" : "opacity-40"
                        )}
                    />
                </span>
            ) : (
                label
            )}
        </TableCell>
    );
}
