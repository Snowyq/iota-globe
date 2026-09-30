import { useContext } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OptionsContextProvider, {
    OptionsContext,
} from "@/features/options/OptionsContext";
import ValidatorsContextProvider, {
    ValidatorsContext,
} from "@/features/validators/ValidatorsContext";
import { deferred, snapshotResponse } from "../helpers/async";
import {
    validatorRecord,
    validatorsSnapshot,
    rewardEvent,
} from "../helpers/fixtures";

const request = vi.fn<typeof fetch>();
beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("fetch", request);
});
const mount = () =>
    renderHook(
        () => ({
            data: useContext(ValidatorsContext),
            options: useContext(OptionsContext),
        }),
        {
            wrapper: ({ children }) => (
                <OptionsContextProvider>
                    <ValidatorsContextProvider>
                        {children}
                    </ValidatorsContextProvider>
                </OptionsContextProvider>
            ),
        }
    );

describe("ValidatorsContext", () => {
    it("loads validators with computed stats", async () => {
        const snapshot = validatorsSnapshot();
        snapshot.epochInfoEvents = [rewardEvent("0xalpha", "1500000000")];
        request.mockResolvedValue(snapshotResponse(snapshot, 15000));
        const { result } = mount();
        expect(result.current.data.isLoading).toBe(true);
        await waitFor(() =>
            expect(result.current.data.validators).toHaveLength(1)
        );
        expect(result.current.data.validators[0].stats).toEqual({
            stakeIOTA: 100,
            stakePercent: 2.5,
            apyPercent: 5,
            lastEpochRewardIOTA: 1.5,
        });
        expect(result.current.data.dataTtl).toBe(15000);
        expect(result.current.data.isLoading).toBe(false);
    });
    it("recovers from a failed first request", async () => {
        request
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(snapshotResponse(validatorsSnapshot()));
        const { result } = mount();
        await waitFor(() => expect(result.current.data.error).toBeTruthy());
        expect(result.current.data.validators).toEqual([]);
        act(() => result.current.data.refresh());
        await waitFor(() =>
            expect(result.current.data.validators).toHaveLength(1)
        );
        expect(result.current.data.error).toBeNull();
    });
    it("clears selection and data on network change", async () => {
        request.mockResolvedValueOnce(snapshotResponse(validatorsSnapshot()));
        const { result } = mount();
        await waitFor(() =>
            expect(result.current.data.validators).toHaveLength(1)
        );
        act(() => result.current.data.selectValidator?.("0xalpha"));
        expect(result.current.data.selectedValidator?.iotaAddress).toBe(
            "0xalpha"
        );
        const next = deferred<Response>();
        request.mockReturnValueOnce(next.promise);
        act(() => result.current.options.selectNetwork?.("testnet"));
        expect(result.current.data.selectedValidator).toBeNull();
        expect(result.current.data.validators).toEqual([]);
        expect(result.current.data.networkStats).toBeNull();
        next.resolve(
            snapshotResponse(
                validatorsSnapshot([
                    validatorRecord({ iotaAddress: "0xtestnet" }),
                ])
            )
        );
        await waitFor(() =>
            expect(result.current.data.validators[0]?.iotaAddress).toBe(
                "0xtestnet"
            )
        );
    });
    it("ignores a late response from the previous network", async () => {
        const old = deferred<Response>(),
            next = deferred<Response>();
        request
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(next.promise);
        const { result } = mount();
        act(() => result.current.options.selectNetwork?.("testnet"));
        next.resolve(
            snapshotResponse(
                validatorsSnapshot([validatorRecord({ iotaAddress: "0xnew" })])
            )
        );
        await waitFor(() =>
            expect(result.current.data.validators[0]?.iotaAddress).toBe("0xnew")
        );
        await act(async () =>
            old.resolve(snapshotResponse(validatorsSnapshot()))
        );
        expect(result.current.data.validators[0].iotaAddress).toBe("0xnew");
    });
    it("does not overlap polls and aborts on unmount", () => {
        vi.useFakeTimers();
        request.mockReturnValue(new Promise(() => {}));
        const { unmount } = mount();
        act(() => vi.advanceTimersByTime(60_000));
        expect(request).toHaveBeenCalledOnce();
        const signal = request.mock.calls[0][1]?.signal;
        unmount();
        expect(signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
