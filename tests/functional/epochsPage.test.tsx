import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EpochsPage from "@/views/EpochsPage";
import type { EpochRow, EpochsApiResponse } from "@/app/api/epochs/route";
import { TestNetwork } from "../helpers/providers";
import { deferred } from "../helpers/async";

// Chart rendering is verified separately in a browser; this suite covers the ledger flow.
vi.mock("@/features/dashboard/EpochHistoryChart", () => ({
    EpochHistoryChart: () => null,
}));
const request = vi.fn<typeof fetch>();
beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("fetch", request);
});
const epoch = (id: string): EpochRow => ({
    epoch: id,
    totalTransactions: "1234",
    stakeRewardsNano: "1500000000",
    lastCheckpointId: "900",
    storageNetInflowNano: "-500000000",
    epochEndTimestamp: "1700000000000",
});
const page = (id: string, nextCursor: string | null): EpochsApiResponse => ({
    epochs: [epoch(id)],
    nextCursor,
    hasNextPage: nextCursor != null,
});

describe("epoch ledger", () => {
    it("shows a pending state and then converts exact ledger amounts", async () => {
        const response = deferred<Response>();
        request.mockReturnValue(response.promise);
        render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        expect(screen.getByText("Loading epoch records")).toBeInTheDocument();
        response.resolve(Response.json(page("41", null)));
        expect(await screen.findByText("#41")).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "1.5" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "-0.5" })).toBeInTheDocument();
    });
    it("follows opaque API cursors and returns to the newer page", async () => {
        request.mockImplementation(async (url) =>
            Response.json(
                String(url).includes("cursor=")
                    ? page("40", null)
                    : page("41", "opaque+cursor/40")
            )
        );
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        await screen.findByText("#41");
        expect(
            screen.getByRole("button", { name: "Newer epochs" })
        ).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Older epochs" }));
        await screen.findByText("#40");
        expect(request.mock.calls.at(-1)?.[0]).toBe(
            "/api/epochs?dataset=mainnet&cursor=opaque%2Bcursor%2F40"
        );
        expect(screen.getByText("Page 2")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Older epochs" })
        ).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Newer epochs" }));
        await screen.findByText("#41");
        expect(request.mock.calls.at(-1)?.[0]).toBe(
            "/api/epochs?dataset=mainnet"
        );
    });
    it("offers retry after an API failure", async () => {
        request
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(Response.json(page("41", null)));
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Epoch history could not be loaded"
        );
        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("#41")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    it("aborts its request when leaving the page", () => {
        request.mockReturnValue(new Promise(() => {}));
        const { unmount } = render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        const signal = request.mock.calls[0][1]?.signal;
        unmount();
        expect(signal?.aborted).toBe(true);
    });
    it("ignores a previous network response even when its JSON resolves after cancellation", async () => {
        const oldBody = deferred<EpochsApiResponse>();
        request
            .mockResolvedValueOnce({
                ok: true,
                json: () => oldBody.promise,
            } as Response)
            .mockResolvedValueOnce(Response.json(page("81", null)));
        const { rerender } = render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        await waitFor(() => expect(request).toHaveBeenCalledOnce());
        const signal = request.mock.calls[0][1]?.signal;
        rerender(
            <TestNetwork network="testnet">
                <EpochsPage />
            </TestNetwork>
        );
        expect(await screen.findByText("#81")).toBeInTheDocument();
        await act(async () => oldBody.resolve(page("41", "old-cursor")));
        expect(signal?.aborted).toBe(true);
        expect(screen.queryByText("#41")).not.toBeInTheDocument();
        expect(screen.getByText("#81")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Older epochs" })
        ).toBeDisabled();
    });
    it("resets pagination without sending another network's cursor", async () => {
        request.mockImplementation(async (url) =>
            Response.json(
                String(url).includes("testnet")
                    ? page("81", null)
                    : String(url).includes("cursor=")
                      ? page("40", null)
                      : page("41", "mainnet-only-cursor")
            )
        );
        const user = userEvent.setup();
        const { rerender } = render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        await screen.findByText("#41");
        await user.click(screen.getByRole("button", { name: "Older epochs" }));
        await screen.findByText("#40");
        rerender(
            <TestNetwork network="testnet">
                <EpochsPage />
            </TestNetwork>
        );
        await screen.findByText("#81");
        expect(screen.getByText("Page 1")).toBeInTheDocument();
        expect(
            request.mock.calls
                .filter(([url]) => String(url).includes("testnet"))
                .map(([url]) => url)
        ).toEqual(["/api/epochs?dataset=testnet"]);
    });
    it("exits loading and offers retry when the request deadline expires", async () => {
        const timeout = new AbortController();
        vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
        request.mockImplementation(
            (_url, options) =>
                new Promise((_resolve, reject) => {
                    options?.signal?.addEventListener(
                        "abort",
                        () =>
                            reject(
                                new DOMException("Timed out", "TimeoutError")
                            ),
                        { once: true }
                    );
                })
        );
        render(
            <TestNetwork>
                <EpochsPage />
            </TestNetwork>
        );
        act(() => timeout.abort());
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Epoch history could not be loaded"
        );
        expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
        expect(
            screen.queryByText("Loading epoch records")
        ).not.toBeInTheDocument();
    });
});
