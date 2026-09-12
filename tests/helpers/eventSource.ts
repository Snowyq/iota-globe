import { vi } from "vitest";

export class TestEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    static instances: TestEventSource[] = [];
    readyState = TestEventSource.CONNECTING;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    close = vi.fn(() => {
        this.readyState = TestEventSource.CLOSED;
    });
    constructor(public url: string) {
        TestEventSource.instances.push(this);
    }
    open() {
        this.readyState = TestEventSource.OPEN;
    }
    emit(data: unknown) {
        this.emitRaw(JSON.stringify(data));
    }
    emitRaw(data: string) {
        if (this.readyState !== TestEventSource.CLOSED)
            this.onmessage?.(new MessageEvent("message", { data }));
    }
    fail() {
        this.readyState = TestEventSource.CONNECTING;
        this.onerror?.();
    }
}
export function installEventSource() {
    TestEventSource.instances = [];
    vi.stubGlobal("EventSource", TestEventSource);
    return TestEventSource;
}
