import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { installMatchMedia } from "./helpers/matchMedia";

// jsdom has no layout engine. These defaults only provide missing APIs;
// tests that verify observer behavior install controllable implementations.
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
