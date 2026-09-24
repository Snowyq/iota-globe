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

// Replace only Next's dynamic loader. The real React worker adapter is exercised.
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

describe("worker adapter lifecycle", () => {
    it("leaves one finger to the page, turns with two, coasts on release and zooms on a double tap", async () => {
        const { container } = render(<Globe />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointermove", 1, 120, 140);
        expect(worker.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: "drag" })
        );
        pointer(canvas, "pointerup", 1, 120, 140);
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointerdown", 2, 200, 100);
        // The midpoint has to travel before the turn starts...
        pointer(canvas, "pointermove", 1, 100, 130);
        // ...and from there the globe follows it.
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
    it("hints at two fingers when one swipes sideways, and keeps the page still under two", async () => {
        const onHint = vi.fn();
        const { container } = render(<Globe onHint={onHint} />);
        await harness.boot();
        const stage = container.querySelector(".globe-worker-stage")!;
        const touch = (type: string, points: [number, number][]) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "touches", {
                value: points.map(([clientX, clientY]) => ({
                    clientX,
                    clientY,
                })),
            });
            act(() => void stage.dispatchEvent(event));
            return event;
        };
        touch("touchstart", [[100, 100]]);
        touch("touchmove", [[150, 104]]);
        expect(onHint).toHaveBeenCalledWith("touch");
        const two = touch("touchmove", [
            [100, 100],
            [200, 100],
        ]);
        expect(two.defaultPrevented).toBe(true);
    });
    it("leaves a plain scroll to the page and zooms with Command held", async () => {
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
    it("pinches to zoom and stops turning when one of two fingers lifts", async () => {
        const { container } = render(<Globe />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointerdown", 2, 200, 100);
        // A clear spread starts the zoom from where it is, then follows.
        pointer(canvas, "pointermove", 2, 300, 100);
        pointer(canvas, "pointermove", 2, 400, 100);
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "view",
            view: { altitude: 1.6 },
            duration: 0,
        });
        pointer(canvas, "pointerup", 1, 100, 100);
        expect(worker.postMessage).toHaveBeenLastCalledWith({
            type: "release",
        });
        pointer(canvas, "pointermove", 2, 320, 100);
        expect(worker.postMessage).toHaveBeenLastCalledWith({
            type: "release",
        });
        pointer(canvas, "pointercancel", 2, 320, 100);
        const count = worker.postMessage.mock.calls.length;
        pointer(canvas, "pointermove", 2, 350, 150);
        expect(worker.postMessage.mock.calls).toHaveLength(count);
    });
    it("does not zoom on the small change of spread that comes with a turn", async () => {
        const { container } = render(<Globe />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        pointer(canvas, "pointerdown", 1, 100, 100);
        pointer(canvas, "pointerdown", 2, 200, 100);
        pointer(canvas, "pointermove", 1, 100, 130);
        pointer(canvas, "pointermove", 2, 212, 140);
        pointer(canvas, "pointermove", 1, 96, 150);
        expect(worker.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: "drag" })
        );
        expect(worker.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: "view" })
        );
    });
    it("keeps mouse dragging available without enabling touch interaction", async () => {
        const { container } = render(<Globe />);
        const worker = await harness.boot();
        const canvas = container.querySelector("canvas")!;
        pointer(canvas, "pointerdown", 1, 10, 20, "mouse");
        pointer(canvas, "pointermove", 1, 30, 25, "mouse");
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "drag",
            dx: 20,
            dy: 5,
        });
    });
    it("waits for paint, transfers a panel-sized canvas and tolerates Strict Mode", async () => {
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
    it("reuses its worker when switching projections", async () => {
        const { rerender } = render(<Globe mode="globe" />);
        const worker = await harness.boot();
        rerender(<Globe mode="map" />);
        expect(TestMapWorker.instances).toHaveLength(1);
        expect(worker.postMessage).toHaveBeenCalledWith({
            type: "mode",
            mode: "map",
        });
        expect(worker.terminate).not.toHaveBeenCalled();
    });
    it("cancels scheduled startup when leaving the view before initialization", async () => {
        const { unmount } = render(<Globe />);
        unmount();
        await harness.boot();
        expect(TestMapWorker.instances).toHaveLength(0);
    });
    it("forwards resize, visibility and keyboard input to the worker", async () => {
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
    it("projects accessible markers without recreating their React tree", async () => {
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

describe("network map interactions", () => {
    it("shows loading until the actual ready event and switches between 3D and 2D", async () => {
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
        // The skeleton fades out over the globe, then leaves.
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
    it("finds a validator from the search palette and returns focus", async () => {
        const user = userEvent.setup();
        mountPanel();
        const worker = await harness.boot();
        act(() => worker.emit({ type: "ready" }));
        const opener = await screen.findByRole("button", {
            name: "Find validator",
        });
        await waitFor(() => expect(opener).toBeEnabled());
        await user.keyboard("{Meta>}k{/Meta}");
        const input = screen.getByRole("combobox", {
            name: /Validator name/,
        });
        expect(input).toHaveFocus();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
        await user.click(opener);
        await user.type(
            screen.getByRole("combobox", { name: /Validator name/ }),
            "warsaw"
        );
        expect(screen.getAllByRole("option")).toHaveLength(1);
        await user.keyboard("{Enter}");
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(
            await screen.findByRole("complementary", { name: /Alpha/ })
        ).toBeInTheDocument();
        expect(TestMapWorker.instances).toHaveLength(1);
    });
    it("keeps a useful fallback and can restart a failed renderer", async () => {
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
    it("starts paused when reduced motion is requested", async () => {
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
