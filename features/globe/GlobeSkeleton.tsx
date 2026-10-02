import { useEffect } from "react";

// Placeholder matching the globe's opening size and position, faded out
// once the renderer is ready.
export function GlobeSkeleton({
    slow = false,
    onRetry,
    mode = "globe",
    leaving = false,
    onGone,
}: {
    slow?: boolean;
    onRetry?: () => void;
    mode?: "globe" | "map";
    leaving?: boolean;
    onGone?: () => void;
}) {
    // Fallback when no transitionend fires (reduced motion, hidden tab).
    useEffect(() => {
        if (!leaving || !onGone) return;
        const timer = window.setTimeout(onGone, 700);
        return () => window.clearTimeout(timer);
    }, [leaving, onGone]);

    return (
        <div
            className={`globe-loading ${mode === "map" ? "is-map" : ""} ${leaving ? "is-leaving" : ""}`}
            role={leaving ? undefined : "status"}
            aria-live={leaving ? undefined : "polite"}
            aria-atomic="true"
            aria-hidden={leaving || undefined}
            onTransitionEnd={(event) => {
                if (leaving && event.target === event.currentTarget) onGone?.();
            }}
        >
            <div className="globe-loading-frame" aria-hidden="true">
                {mode === "map" ? (
                    <div className="globe-loading-map">
                        <div className="globe-loading-dots" />
                    </div>
                ) : (
                    <div className="globe-loading-planet">
                        <div className="globe-loading-dots" />
                    </div>
                )}
            </div>
            <div className="globe-loading-caption">
                <span className="loading-spinner" aria-hidden="true" />
                <div>
                    <strong>
                        {slow
                            ? "The network map is taking a little longer"
                            : mode === "map"
                              ? "Preparing the network map"
                              : "Rendering the validator globe"}
                    </strong>
                    <p>
                        {slow
                            ? "Network metrics remain available while the map starts."
                            : "Drawn in a background worker. The rest of the page is live."}
                    </p>
                </div>
            </div>
            {slow && onRetry && !leaving && (
                <button
                    className="subtle-button globe-loading-retry"
                    onClick={onRetry}
                >
                    Restart map
                </button>
            )}
        </div>
    );
}
