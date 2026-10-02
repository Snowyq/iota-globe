import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Navigation from "@/components/Navigation";
import OptionsContextProvider from "@/features/options/OptionsContext";

vi.mock("next/navigation", () => ({ usePathname: () => "/validators" }));

function renderNavigation() {
    return render(
        <OptionsContextProvider>
            <Navigation />
        </OptionsContextProvider>
    );
}

describe("navigation", () => {
    it("marks the current page and offers a skip link", () => {
        renderNavigation();
        const [topnav, tabbar] = screen.getAllByRole("navigation", {
            name: "Main navigation",
        });
        for (const nav of [topnav, tabbar]) {
            const links = within(nav).getAllByRole("link");
            expect(links).toHaveLength(5);
            expect(
                links.filter((link) => link.getAttribute("aria-current"))
            ).toHaveLength(1);
            expect(
                within(nav).getByRole("link", { name: /Validators/ })
            ).toHaveAttribute("aria-current", "page");
        }
        expect(
            screen.getByRole("link", { name: "Skip to content" })
        ).toHaveAttribute("href", "#main-content");
    });
    it("switches network with the mouse", async () => {
        const user = userEvent.setup();
        renderNavigation();
        const picker = screen.getByRole("combobox", { name: "Network" });
        await user.click(picker);
        await user.click(screen.getByRole("option", { name: /IOTA Testnet/ }));
        expect(picker).toHaveTextContent("Testnet");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    it("switches network with the keyboard", async () => {
        const user = userEvent.setup();
        renderNavigation();
        const picker = screen.getByRole("combobox", { name: "Network" });
        picker.focus();
        await user.keyboard("{ArrowDown}{End}{Enter}");
        expect(picker).toHaveTextContent("Testnet");
        expect(picker).toHaveFocus();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        await user.keyboard("{ArrowUp}{Escape}");
        expect(picker).toHaveAttribute("aria-expanded", "false");
        expect(picker).toHaveFocus();
    });
});
