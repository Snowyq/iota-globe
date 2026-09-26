// The mark: a wireframe globe crossed by one orbit, with a node lit on it.
export function BrandMark({ size = 22 }: { size?: number }) {
    return (
        <svg
            className="brand-mark"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="8.25"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <ellipse
                cx="12"
                cy="12"
                rx="3.4"
                ry="8.25"
                stroke="currentColor"
                strokeWidth="1.1"
                opacity=".55"
            />
            <path
                d="M3.75 12h16.5"
                stroke="currentColor"
                strokeWidth="1.1"
                opacity=".55"
            />
            <path
                d="M1.5 16.6 22.5 7.4"
                stroke="var(--accent)"
                strokeWidth="1.25"
            />
            <rect
                x="17.2"
                y="7.3"
                width="4"
                height="4"
                fill="var(--accent)"
                transform="rotate(-23.7 19.2 9.3)"
            />
        </svg>
    );
}

export default function Logo() {
    return (
        <span className="brand-word">
            IOTA <b>Globe</b>
        </span>
    );
}
