import { useId } from "react";

export function GlobeSkeleton({
    slow = false,
    onRetry,
    mode = "globe",
}: {
    slow?: boolean;
    onRetry?: () => void;
    mode?: "globe" | "map";
}) {
    const id = useId().replace(/:/g, "");
    return (
        <div
            className="globe-loading"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <div
                className={`globe-loading-model ${mode === "map" ? "is-map" : ""}`}
                aria-hidden="true"
            >
                {mode === "map" ? (
                    <svg viewBox="0 0 400 220" fill="none">
                        <rect
                            x="15"
                            y="15"
                            width="370"
                            height="190"
                            rx="0"
                            fill="#081217"
                            stroke="#2b3940"
                        />
                        <g stroke="#2b4a52" opacity=".35">
                            {[77, 138, 200, 262, 323].map((x) => (
                                <path key={x} d={`M${x} 15v190`} />
                            ))}
                            {[62, 110, 158].map((y) => (
                                <path key={y} d={`M15 ${y}h370`} />
                            ))}
                        </g>
                        <path
                            d="M15 110h370"
                            stroke="#39e1ff"
                            strokeDasharray="4 9"
                            opacity=".6"
                        />
                    </svg>
                ) : (
                    <svg viewBox="0 0 320 320" fill="none">
                        <defs>
                            <radialGradient id={`${id}-fill`}>
                                <stop stopColor="#0d1d23" stopOpacity=".5" />
                                <stop
                                    offset="1"
                                    stopColor="#070d10"
                                    stopOpacity=".9"
                                />
                            </radialGradient>
                            <linearGradient
                                id={`${id}-scan`}
                                x1="0"
                                y1="0"
                                x2="320"
                                y2="320"
                            >
                                <stop stopColor="#39e1ff" stopOpacity="0" />
                                <stop offset=".5" stopColor="#39e1ff" />
                                <stop
                                    offset="1"
                                    stopColor="#39e1ff"
                                    stopOpacity="0"
                                />
                            </linearGradient>
                        </defs>
                        <circle
                            cx="160"
                            cy="160"
                            r="118"
                            fill={`url(#${id}-fill)`}
                            stroke="#2b3940"
                        />
                        <g stroke="#2b4a52" opacity=".32">
                            <ellipse cx="160" cy="160" rx="118" ry="40" />
                            <ellipse cx="160" cy="160" rx="118" ry="83" />
                            <ellipse cx="160" cy="160" rx="42" ry="118" />
                            <ellipse cx="160" cy="160" rx="85" ry="118" />
                            <path d="M42 160h236M160 42v236" />
                        </g>
                        <circle
                            className="globe-loading-orbit"
                            cx="160"
                            cy="160"
                            r="136"
                            stroke={`url(#${id}-scan)`}
                            strokeDasharray="110 745"
                            strokeWidth="1.5"
                        />
                        <g stroke="#4fb8c9" opacity=".55">
                            <path d="M160 17v9m0 268v9M17 160h9m268 0h9" />
                        </g>
                    </svg>
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
            {slow && onRetry && (
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
