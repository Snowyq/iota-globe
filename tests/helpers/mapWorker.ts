import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { WorkerInput, WorkerOutput } from "@/features/globe/workerTypes";

export class TestMapWorker {
    static instances: TestMapWorker[] = [];
    onmessage: ((event: MessageEvent<WorkerOutput>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage =
        vi.fn<(message: WorkerInput, transfer?: Transferable[]) => void>();
    terminate = vi.fn();
    constructor(
        public url: URL,
        public options: WorkerOptions
    ) {
        TestMapWorker.instances.push(this);
    }
    emit(message: WorkerOutput) {
        this.onmessage?.({ data: message } as MessageEvent<WorkerOutput>);
    }
}
export function installMapWorker() {
    TestMapWorker.instances = [];
    vi.stubGlobal("Worker", TestMapWorker);
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.set(++frameId, callback);
        return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        "transferControlToOffscreen"
    );
    const transfer = vi.fn(() => ({}) as OffscreenCanvas);
    Object.defineProperty(
        HTMLCanvasElement.prototype,
        "transferControlToOffscreen",
        { configurable: true, value: transfer }
    );
    let width = 640,
        height = 320;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
        () => width
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
        () => height
    );
    const resizeObservers: ResizeObserver[] = [];
    class ControlledResizeObserver implements ResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor(public callback: ResizeObserverCallback) {
            resizeObservers.push(this);
        }
    }
    const intersectionObservers: ControlledIntersectionObserver[] = [];
    class ControlledIntersectionObserver implements IntersectionObserver {
        root = null;
        rootMargin = "100px";
        thresholds = [0];
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = () => [];
        constructor(public callback: IntersectionObserverCallback) {
            intersectionObservers.push(this);
        }
    }
    vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
    vi.stubGlobal("IntersectionObserver", ControlledIntersectionObserver);
    return {
        transfer,
        async frame() {
            await act(async () => {
                const callbacks = [...frames.values()];
                frames.clear();
                callbacks.forEach((callback) => callback(performance.now()));
            });
        },
        async boot() {
            await this.frame();
            await this.frame();
            return TestMapWorker.instances.at(-1)!;
        },
        resize(nextWidth: number, nextHeight: number) {
            width = nextWidth;
            height = nextHeight;
            act(() =>
                resizeObservers.forEach((observer) =>
                    (observer as ControlledResizeObserver).callback(
                        [
                            {
                                contentRect: { width, height },
                            } as ResizeObserverEntry,
                        ],
                        observer
                    )
                )
            );
        },
        visible(visible: boolean) {
            act(() =>
                intersectionObservers.forEach((observer) =>
                    observer.callback(
                        [
                            {
                                isIntersecting: visible,
                            } as IntersectionObserverEntry,
                        ],
                        observer
                    )
                )
            );
        },
        restore() {
            if (descriptor)
                Object.defineProperty(
                    HTMLCanvasElement.prototype,
                    "transferControlToOffscreen",
                    descriptor
                );
            else
                Reflect.deleteProperty(
                    HTMLCanvasElement.prototype,
                    "transferControlToOffscreen"
                );
        },
    };
}
