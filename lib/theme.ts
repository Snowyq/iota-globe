// Colour values for code that cannot read CSS custom properties
// (Recharts props, the Three.js worker, inline SVG). Keep in sync with
// the tokens at the top of app/globals.css.
export const theme = {
    ground: "#0b0f11",
    panel: "#070a0c",
    raised: "#11181c",
    line: "#1b252b",
    lineStrong: "#2b3940",
    text: "#e6f0f1",
    muted: "#879aa1",
    accent: "#39e1ff",
    hot: "#ff6a2c",
    positive: "#53e2a0",
    negative: "#ff5d6e",
    warning: "#ffb547",
    series2: "#8d9bff",
} as const;

export const chartAxis = {
    tick: {
        fill: theme.muted,
        fontSize: 10,
        fontFamily: "var(--font-mono)",
    },
    grid: "#ffffff0d",
    tooltip: {
        background: theme.raised,
        border: `1px solid ${theme.lineStrong}`,
        borderRadius: 2,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: theme.text,
    },
} as const;
