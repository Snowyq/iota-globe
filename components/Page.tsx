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
                "@container section rounded-lg py-8 max-sm:-mt-20",
                className
            )}
        >
            {children}
        </div>
    );
}
