import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNetwork, fetchValidators } from "@/lib/fetch";
import { networkSnapshot, validatorsSnapshot } from "../helpers/fixtures";
import { snapshotResponse } from "../helpers/async";

const request = vi.fn<typeof fetch>();
beforeEach(() => {
    vi.stubGlobal("fetch", request);
    request.mockReset();
});

// Never settles unless the request signal aborts.
const hang: typeof fetch = (_url, options) =>
    new Promise((_resolve, reject) =>
        options?.signal?.addEventListener("abort", () =>
            reject(options.signal?.reason)
        )
    );

describe("snapshot fetch", () => {
    it("requests and decodes each resource", async () => {
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

    it("encodes the dataset param", async () => {
        request.mockResolvedValue(snapshotResponse(networkSnapshot()));
        await fetchNetwork("mainnet&other=true");
        expect(request.mock.calls[0][0]).toBe(
            "/api/network?dataset=mainnet%26other%3Dtrue"
        );
    });

    it("falls back to a default TTL", async () => {
        request.mockImplementation(async () =>
            Response.json({ status: "success", payload: {} })
        );
        expect((await fetchNetwork("mainnet")).ttl).toBe(5000);
        expect((await fetchValidators("mainnet")).ttl).toBe(30000);
    });

    it("rejects HTTP errors and failed payloads", async () => {
        request.mockResolvedValueOnce(
            Response.json({ status: "success", payload: {} }, { status: 503 })
        );
        await expect(fetchNetwork("mainnet")).rejects.toThrow("503");
        for (const body of [
            { status: "error", error: "RPC unavailable" },
            { status: "success", payload: null },
        ]) {
            request.mockResolvedValueOnce(Response.json(body));
            await expect(fetchNetwork("mainnet")).rejects.toThrow();
        }
    });

    it("passes the caller's abort signal through", async () => {
        const controller = new AbortController();
        request.mockImplementation(hang);
        const pending = expect(
            fetchValidators("mainnet", controller.signal)
        ).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await pending;
        expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });

    it("times out after 20 seconds", async () => {
        const deadline = new AbortController();
        const timeout = vi
            .spyOn(AbortSignal, "timeout")
            .mockReturnValue(deadline.signal);
        request.mockImplementation(hang);
        const pending = expect(fetchNetwork("mainnet")).rejects.toMatchObject({
            name: "TimeoutError",
        });
        deadline.abort(new DOMException("Deadline exceeded", "TimeoutError"));
        await pending;
        expect(timeout).toHaveBeenCalledWith(20_000);
    });
});
