import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNetwork, fetchValidators } from "@/lib/fetch";
import { networkSnapshot, validatorsSnapshot } from "../helpers/fixtures";
import { snapshotResponse } from "../helpers/async";

const request = vi.fn<typeof fetch>();
beforeEach(() => {
    vi.stubGlobal("fetch", request);
    request.mockReset();
});
describe("snapshot transport", () => {
    it("routes and decodes each resource using the selected dataset", async () => {
        const network = networkSnapshot(),
            validators = validatorsSnapshot();
        request
            .mockResolvedValueOnce(snapshotResponse(network, 4321))
            .mockResolvedValueOnce(snapshotResponse(validators, 15000));
        expect(await fetchNetwork("mainnet")).toEqual({
            data: network,
            ttl: 4321,
        });
        expect(await fetchValidators("testnet")).toEqual({
            data: validators,
            ttl: 15000,
        });
        expect(request.mock.calls.map(([url]) => url)).toEqual([
            "/api/network?dataset=mainnet",
            "/api/validators?dataset=testnet",
        ]);
    });
    it("encodes dataset values instead of allowing query injection", async () => {
        request.mockResolvedValue(snapshotResponse(networkSnapshot()));
        await fetchNetwork("mainnet&other=true");
        expect(request.mock.calls[0][0]).toBe(
            "/api/network?dataset=mainnet%26other%3Dtrue"
        );
    });
    it.each([
        [fetchNetwork, 5000],
        [fetchValidators, 30000],
    ] as const)("uses the resource TTL fallback", async (load, ttl) => {
        request.mockResolvedValue(
            Response.json({ status: "success", payload: {} })
        );
        expect((await load("mainnet")).ttl).toBe(ttl);
    });
    it("rejects HTTP errors even if the body resembles successful data", async () => {
        request.mockResolvedValue(
            Response.json({ status: "success", payload: {} }, { status: 503 })
        );
        await expect(fetchNetwork("mainnet")).rejects.toThrow("503");
    });
    it.each([
        { status: "error", error: "RPC unavailable" },
        { status: "success", payload: null },
    ])("rejects incomplete or failed API responses", async (body) => {
        request.mockResolvedValue(Response.json(body));
        await expect(fetchNetwork("mainnet")).rejects.toThrow();
    });
    it("propagates caller cancellation to the in-flight request", async () => {
        const controller = new AbortController();
        request.mockImplementation(
            (_url, options) =>
                new Promise((_resolve, reject) =>
                    options?.signal?.addEventListener("abort", () =>
                        reject(options.signal?.reason)
                    )
                )
        );
        const pending = expect(
            fetchValidators("mainnet", controller.signal)
        ).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await pending;
        expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });
    it("enforces the 20-second request deadline", async () => {
        const deadline = new AbortController();
        const timeout = vi
            .spyOn(AbortSignal, "timeout")
            .mockReturnValue(deadline.signal);
        request.mockImplementation(
            (_url, options) =>
                new Promise((_resolve, reject) =>
                    options?.signal?.addEventListener("abort", () =>
                        reject(options.signal?.reason)
                    )
                )
        );
        const pending = expect(fetchNetwork("mainnet")).rejects.toMatchObject({
            name: "TimeoutError",
        });
        deadline.abort(new DOMException("Deadline exceeded", "TimeoutError"));
        await pending;
        expect(timeout).toHaveBeenCalledWith(20_000);
    });
});
