import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { installMatchMedia } from "./helpers/matchMedia";

// jsdom lacks these; the globe tests install controllable versions.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
beforeEach(() => {
    installMatchMedia();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});
