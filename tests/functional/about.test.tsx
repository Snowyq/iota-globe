import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import AboutPage from "@/features/about/AboutPage";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { validator } from "../helpers/fixtures";
import { validatorsContext } from "../helpers/providers";

// GSAP registers ScrollTrigger as the page module loads, before the shared
// setup installs its matchMedia, so a quiet one is in place from the start.
vi.hoisted(() => {
    if (typeof window.matchMedia === "function") return;
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: (media: string) => ({
            matches: false,
            media,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => false,
        }),
    });
});

// jsdom does not scroll, so smooth scrolling has nothing to drive.
vi.mock("lenis/react", () => ({
    ReactLenis: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useLenis: () => undefined,
}));

function renderAbout() {
    const validators = Array.from({ length: 3 }, (_, i) =>
        validator({ iotaAddress: `0x${i}`, payload: { name: `V${i}` } })
    );
    return render(
        <ValidatorsContext value={validatorsContext({ validators })}>
            <AboutPage />
        </ValidatorsContext>
    );
}

describe("about page", () => {
    it("names the project and counts the validators it shows", () => {
        renderAbout();
        expect(
            screen.getByRole("heading", { level: 1, name: "IOTA Globe" })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/A live observatory for the IOTA network: 3/)
        ).toBeInTheDocument();
    });

    it("opens with a table of contents that points at every section", () => {
        renderAbout();
        const contents = screen.getByRole("navigation", {
            name: "On this page",
        });
        const targets = within(contents)
            .getAllByRole("link")
            .map((link) => link.getAttribute("href"))
            .filter((href) => href?.startsWith("#"));
        expect(targets).toEqual([
            "#features",
            "#data-flow",
            "#performance",
            "#decisions",
            "#run",
        ]);
        for (const target of targets)
            expect(document.querySelector(target!)).not.toBeNull();
        // The way into the app sits above the contents, not in them.
        expect(
            within(contents).queryByRole("link", {
                name: "Open the observatory",
            })
        ).toBeNull();
        expect(
            screen.getByRole("link", { name: "Open the observatory" })
        ).toHaveAttribute("href", "/");
    });

    it("brings a feature's screen and fact forward when its name is chosen", async () => {
        renderAbout();
        const search = screen.getByRole("button", { name: "Validator search" });
        expect(search).toHaveAttribute("aria-pressed", "false");
        await userEvent.click(search);
        expect(search).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Globe" })).toHaveAttribute(
            "aria-pressed",
            "false"
        );
        expect(screen.getByText(/⌘K opens a palette/)).toBeInTheDocument();
        expect(
            screen.getByAltText(
                "Search palette over the globe with one match for “swiss”"
            )
        ).toHaveClass("is-active");
    });

    it("lays the decisions out as a table of named groups of rows", () => {
        renderAbout();
        const table = screen.getByRole("table");
        const groups = within(table)
            .getAllByRole("rowgroup")
            .map((group) => group.getAttribute("aria-label"))
            .filter(Boolean);
        expect(groups).toEqual(["Rendering", "Data", "Interface", "Quality"]);
        expect(
            within(table).getByRole("row", { name: /Globe in a Web Worker/ })
        ).toBeInTheDocument();
    });

    it("ends with a way back to the very top", () => {
        renderAbout();
        expect(
            screen.getByRole("link", { name: "Back to top" })
        ).toHaveAttribute("href", "#top");
    });
});
