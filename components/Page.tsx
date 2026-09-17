import { cn } from "@/lib/utils";

export function Page({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "page @container flex w-full min-w-0 flex-col [overflow-anchor:none]",
                className
            )}
        >
            {children}
        </div>
    );
}
