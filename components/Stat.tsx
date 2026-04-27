import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Copy } from "lucide-react";
import { Button } from "./ui/button";

const statVariants = cva("flex flex-col", {
    variants: {
        size: {
            xs: "gap-0",
            sm: "gap-0",
            default: "gap-0.5",
            lg: "gap-1",
        },
    },
    defaultVariants: { size: "default" },
});

const valueVariants = cva("font-medium tabular-nums", {
    variants: {
        size: {
            xs: "text-base",
            sm: "text-lg",
            default: "text-2xl",
            lg: "text-3xl",
        },
    },
    defaultVariants: { size: "default" },
});

const subVariants = cva("text-muted-foreground", {
    variants: {
        size: {
            xs: "text-[10px]",
            sm: "text-xs",
            default: "text-xs",
            lg: "text-sm",
        },
    },
    defaultVariants: { size: "default" },
});

const labelVariants = cva("text-muted-foreground", {
    variants: {
        size: {
            xs: "text-[10px]",
            sm: "text-xs",
            default: "text-xs",
            lg: "text-sm",
        },
    },
    defaultVariants: { size: "default" },
});

const innerClassVariants = cva("flex items-baseline gap-1", {
    variants: {
        size: {
            xs: "gap-1",
            sm: "gap-1",
            default: "gap-2",
            lg: "gap-2",
        },
    },
    defaultVariants: { size: "default" },
});

const ICON_BTN_SIZES = {
    xs: "icon-xs",
    sm: "icon-sm",
    default: "icon",
    lg: "icon-lg",
} as const;

export function Stat({
    value,
    label,
    sub,
    size,
    className,
    innerClassName,
    withCopy,
    copyValue,
}: {
    value: React.ReactNode;
    label?: string;
    sub?: string;
    className?: string;
    innerClassName?: string;
    withCopy?: boolean;
    copyValue?: string;
} & VariantProps<typeof statVariants>) {
    return (
        <div className={cn(statVariants({ size }), className)}>
            <div className={cn(innerClassVariants({ size }), innerClassName)}>
                <span className={valueVariants({ size })}>
                    {value == null || (typeof value === "number" && isNaN(value)) ? "—" : value}
                </span>
                {sub && <span className={subVariants({ size })}>{sub}</span>}
                {withCopy && (
                    <Button
                        onClick={() =>
                            navigator.clipboard.writeText(copyValue ?? String(value))
                        }
                        variant={"ghost"}
                        size={size ? ICON_BTN_SIZES[size] : "icon"}
                    >
                        <Copy />
                    </Button>
                )}
            </div>
            {label && <span className={labelVariants({ size })}>{label}</span>}
        </div>
    );
}
