import { useContext } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OptionsContextProvider, {
    OptionsContext,
} from "@/features/options/OptionsContext";
import NetworkContextProvider, {
    NetworkContext,
} from "@/features/network/NetworkContext";
import { deferred, snapshotResponse } from "../helpers/async";
import { networkSnapshot } from "../helpers/fixtures";

const request = vi.fn<typeof fetch>();
beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("fetch", request);
});
const mount = () =>
    renderHook(
        () => ({
            data: useContext(NetworkContext),
            options: useContext(OptionsContext),
        }),
        {
            wrapper: ({ children }) => (
                <OptionsContextProvider>
                    <NetworkContextProvider>{children}</NetworkContextProvider>
                </OptionsContextProvider>
            ),
        }
    );

describe("NetworkContext", () => {
    it("loads a snapshot", async () => {
        const response = deferred<Response>();
        request.mockReturnValue(response.promise);
        const { result } = mount();
        expect(result.current.data).toMatchObject({
            isLoading: true,
            networkMetrics: null,
            updatedAt: null,
        });
        response.resolve(snapshotResponse(networkSnapshot()));
        await waitFor(() =>
            expect(result.current.data.totalTransactions).toBe("1500")
        );
        expect(result.current.data.isLoading).toBe(false);
        expect(result.current.data.updatedAt).toEqual(expect.any(Number));
    });
    it("keeps the last snapshot when a refresh fails", async () => {
        request.mockResolvedValueOnce(snapshotResponse(networkSnapshot()));
        const { result } = mount();
        await waitFor(() =>
            expect(result.current.data.totalTransactions).toBe("1500")
        );
        request.mockResolvedValueOnce(new Response(null, { status: 503 }));
        act(() => result.current.data.refresh());
        await waitFor(() => expect(result.current.data.error).toBeTruthy());
        expect(result.current.data.totalTransactions).toBe("1500");
        request.mockResolvedValueOnce(
            snapshotResponse(networkSnapshot({ totalTransactions: "2000" }))
        );
        act(() => result.current.data.refresh());
        await waitFor(() =>
            expect(result.current.data.totalTransactions).toBe("2000")
        );
        expect(result.current.data.error).toBeNull();
    });
    it("ignores a late response from the previous network", async () => {
        const old = deferred<Response>(),
            next = deferred<Response>();
        request
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(next.promise);
        const { result } = mount();
        const oldSignal = request.mock.calls[0][1]?.signal;
        act(() => result.current.options.selectNetwork?.("testnet"));
        expect(oldSignal?.aborted).toBe(true);
        expect(result.current.data.networkMetrics).toBeNull();
        next.resolve(
            snapshotResponse(
                networkSnapshot({ totalTransactions: "testnet-value" })
            )
        );
        await waitFor(() =>
            expect(result.current.data.totalTransactions).toBe("testnet-value")
        );
        await act(async () => {
            old.resolve(
                snapshotResponse(
                    networkSnapshot({ totalTransactions: "old-mainnet-value" })
                )
            );
        });
        expect(result.current.data.totalTransactions).toBe("testnet-value");
    });
    it("does not overlap polls and aborts on unmount", async () => {
        vi.useFakeTimers();
        request.mockReturnValue(new Promise(() => {}));
        const { unmount } = mount();
        act(() => vi.advanceTimersByTime(15_000));
        expect(request).toHaveBeenCalledOnce();
        const signal = request.mock.calls[0][1]?.signal;
        unmount();
        expect(signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
