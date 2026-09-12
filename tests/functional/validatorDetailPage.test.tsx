import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ValidatorDetailPage from "@/views/ValidatorDetailPage";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { validatorsContext } from "../helpers/providers";
import { validator } from "../helpers/fixtures";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "0xalpha" }) }));

describe("validator detail recovery", () => {
    it("provides a heading and manual retry when the initial snapshot fails", async () => {
        const refresh = vi.fn();
        const user = userEvent.setup();
        render(
            <ValidatorsContext
                value={validatorsContext({ error: "RPC unavailable", refresh })}
            >
                <ValidatorDetailPage />
            </ValidatorsContext>
        );
        expect(
            screen.getByRole("heading", { level: 1, name: "Validator details" })
        ).toBeInTheDocument();
        expect(
            screen.getByText("Validator data unavailable")
        ).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(refresh).toHaveBeenCalledOnce();
        expect(
            screen.getByRole("link", { name: "All validators" })
        ).toHaveAttribute("href", "/validators");
    });
    it("keeps validator metrics visible during retry and prevents repeated clicks", () => {
        render(
            <ValidatorsContext
                value={validatorsContext({
                    validators: [validator()],
                    isLoading: true,
                    error: "RPC unavailable",
                })}
            >
                <ValidatorDetailPage />
            </ValidatorsContext>
        );
        expect(
            screen.getByRole("heading", { level: 1, name: "Alpha" })
        ).toBeInTheDocument();
        expect(screen.getByText("Total staked")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Retrying…" })
        ).toBeDisabled();
        expect(
            screen.getByText(/Displaying the last available snapshot/)
        ).toBeInTheDocument();
    });
});
