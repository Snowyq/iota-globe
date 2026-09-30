import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { GlobeContext } from "@/features/globe/GlobeContext";
import ValidatorsTable from "@/features/validators/ValidatorsTable";
import { validator } from "../helpers/fixtures";
import { validatorsContext, globeContext } from "../helpers/providers";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const alpha = validator();
const beta = validator({
    iotaAddress: "0xbeta",
    apy: 0.12,
    isCommitteeMember: false,
    isAtRisk: true,
    payload: { name: "Beta", stakingPoolIotaBalance: "300000000000" },
    geo: { ...alpha.geo!, country: "Germany" },
});
const missing = validator({
    iotaAddress: "0xmissing",
    apy: null,
    payload: { name: "No APY", stakingPoolIotaBalance: "10000000000" },
});
function table(
    query = "",
    filter: "all" | "committee" | "active" | "at-risk" = "all",
    records = [alpha, beta, missing]
) {
    return (
        <ValidatorsContext value={validatorsContext({ validators: records })}>
            <ValidatorsTable query={query} filter={filter} />
        </ValidatorsContext>
    );
}
const names = () =>
    screen
        .getAllByRole("row", { name: /^View / })
        .map((row) => row.getAttribute("aria-label"));

describe("ValidatorsTable", () => {
    it("keeps rows visible while reloading", () => {
        render(
            <ValidatorsContext
                value={validatorsContext({
                    validators: [alpha],
                    isLoading: true,
                })}
            >
                <ValidatorsTable query="" />
            </ValidatorsContext>
        );
        expect(
            screen.getByRole("row", { name: "View Alpha" })
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Loading validators…")
        ).not.toBeInTheDocument();
    });
    it("searches by name, address or country", () => {
        const { rerender } = render(table("  ALPHA  "));
        expect(names()).toEqual(["View Alpha"]);
        for (const query of ["0xbeta", "germany"]) {
            rerender(table(query));
            expect(names()).toEqual(["View Beta"]);
        }
    });
    it("filters by status", () => {
        const { rerender } = render(table("", "committee"));
        expect(names()).toEqual(["View Alpha", "View No APY"]);
        for (const filter of ["active", "at-risk"] as const) {
            rerender(table("", filter));
            expect(names()).toEqual(["View Beta"]);
        }
    });
    it("sorts both ways and sets aria-sort", async () => {
        const user = userEvent.setup();
        render(table());
        expect(names()[0]).toBe("View Beta");
        await user.click(screen.getByRole("button", { name: "Sort by APY" }));
        expect(names()).toEqual(["View Beta", "View Alpha", "View No APY"]);
        expect(
            screen.getByRole("columnheader", { name: "APY" })
        ).toHaveAttribute("aria-sort", "descending");
        await user.click(screen.getByRole("button", { name: "Sort by APY" }));
        expect(names()).toEqual(["View No APY", "View Alpha", "View Beta"]);
    });
    it("paginates and resets on a new query", async () => {
        const user = userEvent.setup();
        const records = Array.from({ length: 20 }, (_, i) =>
            validator({
                iotaAddress: `0x${i}`,
                payload: {
                    name: `Operator ${String(i).padStart(2, "0")}`,
                    stakingPoolIotaBalance: String((20 - i) * 1e9),
                },
            })
        );
        const { rerender } = render(table("", "all", records));
        expect(names()).toHaveLength(15);
        expect(
            screen.getByRole("button", { name: "Previous validator page" })
        ).toBeDisabled();
        await user.click(
            screen.getByRole("button", { name: "Next validator page" })
        );
        expect(names()).toHaveLength(5);
        expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
        rerender(table("Operator 19", "all", records));
        expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
        expect(names()).toEqual(["View Operator 19"]);
    });
    it("shows an empty state", () => {
        render(table("does-not-exist"));
        expect(screen.getByText("No validators found.")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Next validator page" })
        ).toBeDisabled();
    });
    it("opens a validator from the keyboard", async () => {
        const user = userEvent.setup(),
            selectValidator = vi.fn(),
            moveGlobeTo = vi.fn();
        render(
            <GlobeContext value={globeContext({ moveGlobeTo })}>
                <ValidatorsContext
                    value={validatorsContext({
                        validators: [alpha],
                        selectValidator,
                    })}
                >
                    <ValidatorsTable query="" />
                </ValidatorsContext>
            </GlobeContext>
        );
        screen.getByRole("row", { name: "View Alpha" }).focus();
        await user.keyboard("{Enter}");
        expect(selectValidator).toHaveBeenCalledWith(alpha.iotaAddress);
        expect(router.push).toHaveBeenCalledWith(
            `/validators/${alpha.iotaAddress}`
        );
        await waitFor(() =>
            expect(moveGlobeTo).toHaveBeenCalledWith(52.23, 21.01, 0.8)
        );
    });
});
