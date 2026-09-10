import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn("loading-skeleton", className)}
        />
    );
}

export function LoadingState({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn("loading-state", className)}
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            {children && (
                <div className="loading-preview" aria-hidden="true">
                    {children}
                </div>
            )}
            <div className="loading-caption">
                <span className="loading-spinner" aria-hidden="true" />
                <div>
                    <strong>{title}</strong>
                    {description && <p>{description}</p>}
                </div>
            </div>
        </div>
    );
}

export function ActivitySkeleton() {
    return (
        <LoadingState
            title="Connecting to the activity stream"
            description="New events will appear automatically."
            className="activity-loading"
        >
            <div className="activity-skeleton-rows">
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i}>
                        <SkeletonBlock className="skeleton-event-icon" />
                        <div>
                            <SkeletonBlock className="skeleton-event-id" />
                            <SkeletonBlock className="skeleton-event-meta" />
                        </div>
                        <SkeletonBlock className="skeleton-event-time" />
                    </div>
                ))}
            </div>
        </LoadingState>
    );
}

export function ChartSkeleton({
    title = "Collecting live samples",
    description = "The chart appears after the first two samples.",
}: {
    title?: string;
    description?: string;
}) {
    return (
        <LoadingState
            title={title}
            description={description}
            className="chart-loading"
        >
            <div className="chart-skeleton-grid">
                <i />
                <i />
                <i />
                <i />
            </div>
        </LoadingState>
    );
}
