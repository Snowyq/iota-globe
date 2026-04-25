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
                "@container section rounded-lg bg-background/30 py-8 backdrop-blur-xl max-sm:-mt-20",
                className
            )}
        >
            {children}
        </div>
    );
}
