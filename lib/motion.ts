export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () =>
    window.matchMedia(REDUCED_MOTION).matches;
