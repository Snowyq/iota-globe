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
                "@container section gap-8 rounded-lg py-8 [overflow-anchor:none] max-sm:-mt-20",
                className
            )}
        >
            {children}
        </div>
    );
}
