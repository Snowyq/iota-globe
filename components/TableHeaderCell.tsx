import { cn } from "@/lib/utils";
import { TableHead } from "./ui/table";

export type TableHeaderCellProps = {
    label: string;
    align?: "left" | "center" | "right";
    icon?: React.ComponentType<{ className?: string }>;
    iconActive?: boolean;
    onClick?: () => void;
    sortDirection?: "asc" | "desc";
    className?: string;
};

export function TableHeaderCell({
    label,
    align,
    icon: Icon,
    iconActive,
    onClick,
    sortDirection,
    className,
}: TableHeaderCellProps) {
    const content = (
        <>
            {label}
            {Icon && (
                <Icon
                    className={cn(
                        "h-3 w-3 shrink-0",
                        iconActive ? "text-primary" : "opacity-40"
                    )}
                />
            )}
        </>
    );
    return (
        <TableHead
            scope="col"
            aria-sort={
                iconActive
                    ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                    : undefined
            }
            className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                className
            )}
        >
            {onClick ? (
                <button
                    className={cn(
                        "inline-flex items-center gap-2 py-2",
                        align === "right" && "justify-end"
                    )}
                    onClick={onClick}
                    aria-label={`Sort by ${label}`}
                >
                    {content}
                </button>
            ) : (
                content
            )}
        </TableHead>
    );
}
