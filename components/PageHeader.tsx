export function PageHeader({
    title,
    description,
    action,
}: {
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h1 className="font-heading text-lg font-medium">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
