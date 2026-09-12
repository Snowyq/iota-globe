import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Navigation from "@/components/Navigation";
import OptionsContextProvider from "@/features/options/OptionsContext";
import { installMatchMedia } from "../helpers/matchMedia";

vi.mock("next/navigation", () => ({ usePathname: () => "/validators" }));

describe("responsive navigation", () => {
    it("opens, closes with Escape and removes the hidden drawer from interaction", async () => {
        installMatchMedia({ "(max-width: 680px)": true });
        const user = userEvent.setup();
        render(
            <OptionsContextProvider>
                <Navigation />
            </OptionsContextProvider>
        );
        const sidebar = document.getElementById("site-nav")!;
        expect(sidebar).toHaveAttribute("inert");
        await user.click(
            screen.getByRole("button", { name: "Open navigation" })
        );
        expect(sidebar).not.toHaveAttribute("inert");
        expect(screen.getByRole("combobox", { name: "Network" })).toHaveFocus();
        expect(
            screen.getByRole("button", {
                name: "Close navigation",
                expanded: true,
            })
        ).toHaveAttribute("aria-expanded", "true");
        await user.keyboard("{Escape}");
        expect(sidebar).toHaveAttribute("inert");
        expect(
            screen.getByRole("button", { name: "Open navigation" })
        ).toHaveFocus();
    });
    it("cycles keyboard focus inside the mobile navigation instead of entering the obscured page", async () => {
        installMatchMedia({ "(max-width: 680px)": true });
        const user = userEvent.setup();
        render(
            <OptionsContextProvider>
                <Navigation />
                <button>Page action</button>
            </OptionsContextProvider>
        );
        await user.click(
            screen.getByRole("button", { name: "Open navigation" })
        );
        const toggle = screen.getByRole("button", {
            name: "Close navigation",
            expanded: true,
        });
        const last = screen.getByRole("link", { name: /Documentation/ });
        last.focus();
        await user.tab();
        expect(toggle).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("combobox", { name: "Network" })).toHaveFocus();
        toggle.focus();
        await user.tab({ shift: true });
        expect(last).toHaveFocus();
        await user.keyboard("{Escape}");
        expect(toggle).toHaveFocus();
    });
    it("switches networks through the accessible picker and closes mobile state on desktop resize", async () => {
        const media = installMatchMedia({ "(max-width: 680px)": true });
        const user = userEvent.setup();
        render(
            <OptionsContextProvider>
                <Navigation />
            </OptionsContextProvider>
        );
        await user.click(
            screen.getByRole("button", { name: "Open navigation" })
        );
        await user.click(screen.getByRole("combobox", { name: "Network" }));
        await user.click(screen.getByRole("option", { name: /IOTA Testnet/ }));
        expect(
            screen.getByRole("combobox", { name: "Network" })
        ).toHaveTextContent("IOTA Testnet");
        act(() => media.set("(max-width: 680px)", false));
        expect(
            screen.getByRole("button", { name: "Open navigation" })
        ).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById("site-nav")).not.toHaveAttribute(
            "inert"
        );
    });
    it("supports keyboard choice and closes the picker before closing the drawer", async () => {
        installMatchMedia({ "(max-width: 680px)": true });
        const user = userEvent.setup();
        render(
            <OptionsContextProvider>
                <Navigation />
            </OptionsContextProvider>
        );
        await user.click(
            screen.getByRole("button", { name: "Open navigation" })
        );
        const picker = screen.getByRole("combobox", { name: "Network" });
        await user.keyboard("{ArrowDown}{End}{Enter}");
        expect(picker).toHaveTextContent("IOTA Testnet");
        expect(picker).toHaveFocus();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        await user.keyboard("{ArrowUp}{Escape}");
        expect(picker).toHaveAttribute("aria-expanded", "false");
        expect(
            screen.getByRole("button", {
                name: "Close navigation",
                expanded: true,
            })
        ).toBeInTheDocument();
        expect(document.body).not.toHaveAttribute("data-scroll-locked");
        expect(document.body.style.overflow).toBe("");
        await user.keyboard("{Escape}");
        expect(
            screen.getByRole("button", { name: "Open navigation" })
        ).toHaveFocus();
    });
});
