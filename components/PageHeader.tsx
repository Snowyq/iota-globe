import { cn } from "@/lib/utils";

export function PageHeader({
    title,
    description,
    action,
    actionNearby = false,
}: {
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    actionNearby?: boolean;
}) {
    return (
        <div className={cn("page-heading flex flex-col items-start gap-2")}>
            <div
                className={cn(
                    "flex w-full items-center gap-4",
                    actionNearby ? "justify-start" : "justify-between"
                )}
            >
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {title}
                </h1>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}
        </div>
    );
}
