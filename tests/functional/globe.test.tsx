import { StrictMode } from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Globe } from "@/features/globe/Globe";
import GlobeContextProvider, {
    GlobeContext,
} from "@/features/globe/GlobeContext";
import ValidatorsContextProvider from "@/features/validators/ValidatorsContext";
import OptionsContextProvider from "@/features/options/OptionsContext";
import { GlobePanel } from "@/features/dashboard/GlobePanel";
import { installMapWorker, TestMapWorker } from "../helpers/mapWorker";
import { globeContext } from "../helpers/providers";
import { snapshotResponse } from "../helpers/async";
import { validatorRecord, validatorsSnapshot } from "../helpers/fixtures";
import { installMatchMedia } from "../helpers/matchMedia";

// Skip next/dynamic, render the real Globe.
vi.mock("@/features/globe/GlobeNoSSR", async () => ({
    GlobeNoSSR: (await import("@/features/globe/Globe")).Globe,
}));
let harness: ReturnType<typeof installMapWorker>;
function pointer(
    canvas: HTMLCanvasElement,
    type: string,
    pointerId: number,
    x: number,
    y: number,
    pointerType = "touch"
) {
    const event = Object.assign(
        new Event(type, { bubbles: true, cancelable: true }),
        {
            pointerId,
            pointerType,
            clientX: x,
            clientY: y,
            button: 0,
        }
    );
    act(() => {
        canvas.dispatchEvent(event);
    });
}
beforeEach(() => {
    harness = installMapWorker();
});
afterEach(() => {
    cleanup();
    harness.restore();
});

function mountPanel() {
    vi.stubGlobal(
        "fetch",
        vi
            .fn()
            .mockImplementation(() =>
                Promise.resolve(
                    snapshotResponse(validatorsSnapshot([validatorRecord()]))
                )
            )
    );
    return render(
        <OptionsContextProvider>
            <ValidatorsContextProvider>
                <GlobeContextProvider>
                    <GlobePanel />
                </GlobeContextProvider>
            </ValidatorsContextProvider>
        </OptionsContextProvider>
    );
}

describe("Globe", () => {
    it("rotates with two fingers and zooms on double tap", async () => {
        const { container } = render(<Globe />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        // One finger is left to page scroll.
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointermove", 1, 120, 140);
        expect(worker.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: "drag" })
        );
        pointer(canvas, "pointerup", 1, 120, 140);
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointerdown", 2, 200, 100);
        // The midpoint must move past a threshold before turning starts.
        pointer(canvas, "pointermove", 1, 100, 130);
        pointer(canvas, "pointermove", 2, 200, 130);
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "drag",
            dx: 0,
            dy: 15,
        });
        pointer(canvas, "pointerup", 2, 200, 130);
        pointer(canvas, "pointerup", 1, 100, 130);
        expect(worker.postMessage).toHaveBeenLastCalledWith({
            type: "release",
        });
        pointer(canvas, "pointerdown", 1, 200, 100);
        pointer(canvas, "pointerup", 1, 200, 100);
        pointer(canvas, "pointerdown", 1, 202, 101);
        pointer(canvas, "pointerup", 1, 202, 101);
        expect(worker.postMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "zoom", factor: 0.6 })
        );
        expect(TestMapWorker.instances).toHaveLength(1);
    });
    it("zooms on wheel only with Cmd held", async () => {
        const onHint = vi.fn();
        const { container } = render(<Globe onHint={onHint} />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        const plain = new WheelEvent("wheel", {
            deltaY: 40,
            bubbles: true,
            cancelable: true,
        });
        act(() => void canvas.dispatchEvent(plain));
        expect(plain.defaultPrevented).toBe(false);
        expect(onHint).toHaveBeenCalledWith("wheel");
        const zoom = new WheelEvent("wheel", {
            deltaY: -40,
            metaKey: true,
            bubbles: true,
            cancelable: true,
        });
        act(() => void canvas.dispatchEvent(zoom));
        expect(zoom.defaultPrevented).toBe(true);
        expect(worker.postMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: "zoom" })
        );
    });
    it("boots the worker after paint and survives Strict Mode", async () => {
        const onReady = vi.fn();
        const { unmount } = render(
            <StrictMode>
                <Globe onReady={onReady} />
            </StrictMode>
        );
        expect(TestMapWorker.instances).toHaveLength(0);
        const worker = await harness.boot();
        expect(TestMapWorker.instances).toHaveLength(1);
        expect(harness.transfer).toHaveBeenCalledOnce();
        expect(worker.options).toMatchObject({ type: "module" });
        expect(worker.postMessage.mock.calls[0][0]).toMatchObject({
            type: "init",
            width: 640,
            height: 320,
        });
        expect(onReady).not.toHaveBeenCalled();
        act(() => worker.emit({ type: "ready" }));
        expect(onReady).toHaveBeenCalledOnce();
        unmount();
        expect(worker.terminate).toHaveBeenCalledOnce();
        act(() => worker.emit({ type: "ready" }));
        expect(onReady).toHaveBeenCalledOnce();
    });
    it("skips startup if unmounted first", async () => {
        const { unmount } = render(<Globe />);
        unmount();
        await harness.boot();
        expect(TestMapWorker.instances).toHaveLength(0);
    });
    it("forwards resize, visibility and keyboard input", async () => {
        render(<Globe />);
        const worker = await harness.boot();
        harness.resize(900, 500);
        expect(worker.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: "resize", width: 900, height: 500 })
        );
        harness.visible(false);
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "visibility",
            visible: false,
        });
        fireEvent.keyDown(screen.getByLabelText(/Interactive network map/), {
            key: "ArrowRight",
        });
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "drag",
            dx: -24,
            dy: 0,
        });
        fireEvent.keyDown(screen.getByLabelText(/Interactive network map/), {
            key: "+",
        });
        expect(worker.postMessage).toHaveBeenLastCalledWith({
            type: "zoom",
            factor: 0.85,
        });
    });
    it("positions markers from worker frames", async () => {
        const point = { lat: 0, lng: 0, iotaAddress: "0xalpha" };
        render(
            <GlobeContext value={globeContext({ geoPoints: [point] })}>
                <Globe />
            </GlobeContext>
        );
        const worker = await harness.boot();
        const data = worker.postMessage.mock.calls
            .map(([message]) => message)
            .filter((message) => message.type === "data")
            .at(-1)!;
        expect(data.type).toBe("data");
        if (data.type !== "data") throw new Error("Missing marker data");
        const marker = screen.getByRole("button", {
            name: /Inspect validator/,
            hidden: true,
        }).parentElement!;
        expect(marker).toHaveAttribute("hidden");
        act(() =>
            worker.emit({
                type: "frame",
                view: { lat: 26, lng: 8, altitude: 2.1 },
                markers: [
                    { id: data.clusters[0].id, x: 120, y: 80, visible: true },
                ],
            })
        );
        expect(marker).not.toHaveAttribute("hidden");
        expect(marker).toHaveStyle({
            transform: "translate3d(120px, 80px, 0px)",
        });
        act(() =>
            worker.emit({
                type: "frame",
                view: { lat: 26, lng: 8, altitude: 2.1 },
                markers: [
                    { id: data.clusters[0].id, x: 120, y: 80, visible: false },
                ],
            })
        );
        expect(marker).toHaveAttribute("hidden");
    });
});

describe("GlobePanel", () => {
    it("enables controls on ready and switches 3D/2D", async () => {
        const user = userEvent.setup();
        mountPanel();
        expect(
            screen.getByText("Rendering the validator globe")
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Find validator" })
        ).toBeDisabled();
        const worker = await harness.boot();
        act(() => worker.emit({ type: "ready" }));
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "Find validator" })
        ).toBeEnabled();
        await waitFor(() =>
            expect(
                screen.queryByText("Rendering the validator globe")
            ).not.toBeInTheDocument()
        );
        await user.click(screen.getByRole("button", { name: "2D map" }));
        expect(screen.getByRole("button", { name: "2D map" })).toHaveAttribute(
            "aria-pressed",
            "true"
        );
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "mode",
            mode: "map",
        });
        expect(TestMapWorker.instances).toHaveLength(1);
        await user.click(screen.getByRole("button", { name: "Zoom in" }));
        expect(worker.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: "view" })
        );
    });
    it("shows a fallback and restarts after an error", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const user = userEvent.setup();
        mountPanel();
        const old = await harness.boot();
        act(() => old.emit({ type: "error", message: "GPU context lost" }));
        expect(screen.getByText("The map could not start")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Explore validators" })
        ).toHaveAttribute("href", "/validators");
        expect(old.terminate).toHaveBeenCalledOnce();
        await user.click(screen.getByRole("button", { name: "Try map again" }));
        const replacement = await harness.boot();
        expect(replacement).not.toBe(old);
        act(() => replacement.emit({ type: "ready" }));
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    });
    it("starts paused with reduced motion", async () => {
        installMatchMedia({ "(prefers-reduced-motion: reduce)": true });
        mountPanel();
        const worker = await harness.boot();
        expect(worker.postMessage.mock.calls[0][0]).toMatchObject({
            type: "init",
            reducedMotion: true,
        });
        act(() => worker.emit({ type: "ready" }));
        expect(
            screen.getByRole("button", { name: "Resume globe rotation" })
        ).toBeInTheDocument();
    });
});
