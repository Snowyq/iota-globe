import { Stat } from "@/components/Stat";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type FormattedCellProps = {
    value: React.ReactNode;
    label?: string;
    align?: "left" | "center" | "right";
    size?: "xs" | "sm" | "default" | "lg";
    className?: string;
};

export function FormattedCell({
    value,
    label,
    align = "left",
    size = "xs",
    className,
}: FormattedCellProps) {
    return (
        <TableCell
            className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                className
            )}
        >
            <Stat
                value={value}
                sub={label}
                size={size}
                innerClassName={cn(
                    align === "center" && "justify-center",
                    align === "right" && "justify-end"
                )}
            />
        </TableCell>
    );
}
