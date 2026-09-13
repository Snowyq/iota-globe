import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/CopyButton";

describe("clipboard feedback", () => {
    it("copies the full identifier and resets success feedback", async () => {
        userEvent.setup();
        vi.useFakeTimers();
        const write = vi
            .spyOn(navigator.clipboard, "writeText")
            .mockResolvedValue();
        render(
            <CopyButton
                value="0x-full-address"
                label="Copy validator address"
            />
        );
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Copy validator address" })
            );
        });
        expect(write).toHaveBeenCalledWith("0x-full-address");
        expect(
            screen.getByRole("button", { name: "Copied" })
        ).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
            "Copied to clipboard"
        );
        act(() => vi.advanceTimersByTime(2000));
        expect(
            screen.getByRole("button", { name: "Copy validator address" })
        ).toBeInTheDocument();
    });
    it("reports permission failure and supports a subsequent retry", async () => {
        const user = userEvent.setup();
        const write = vi
            .spyOn(navigator.clipboard, "writeText")
            .mockRejectedValueOnce(new Error("Permission denied"))
            .mockResolvedValueOnce();
        render(<CopyButton value="identifier" />);
        await user.click(screen.getByRole("button", { name: "Copy value" }));
        expect(screen.getByRole("status")).toHaveTextContent(
            "Unable to access clipboard"
        );
        await user.click(
            screen.getByRole("button", { name: "Copy failed. Try again." })
        );
        expect(write).toHaveBeenCalledTimes(2);
        expect(
            screen.getByRole("button", { name: "Copied" })
        ).toBeInTheDocument();
    });
    it("cancels its feedback timer on unmount", async () => {
        userEvent.setup();
        vi.useFakeTimers();
        vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        const { unmount } = render(<CopyButton value="identifier" />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Copy value" }));
        });
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
