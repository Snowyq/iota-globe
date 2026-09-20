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
        <div
            className={cn(
                "page-heading",
                actionNearby && "page-heading-nearby"
            )}
        >
            <div className="page-heading-text">
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {action && <div className="page-heading-action">{action}</div>}
        </div>
    );
}
