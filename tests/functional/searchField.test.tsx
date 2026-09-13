import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SearchField } from "@/components/SearchField";

function Search() {
    const [value, setValue] = useState("");
    return (
        <SearchField
            label="Search validators"
            placeholder="Name or address"
            value={value}
            onChange={setValue}
        />
    );
}
describe("search field", () => {
    it("clears the query without losing input focus", async () => {
        const user = userEvent.setup();
        render(<Search />);
        const input = screen.getByRole("textbox", {
            name: "Search validators",
        });
        await user.type(input, "Alpha");
        await user.click(screen.getByRole("button", { name: "Clear search" }));
        expect(input).toHaveValue("");
        expect(input).toHaveFocus();
        expect(input).toHaveAttribute("autocapitalize", "none");
        expect(input).toHaveAttribute("enterkeyhint", "search");
    });
    it("consumes Escape only while there is a query to clear", async () => {
        const user = userEvent.setup();
        render(<Search />);
        const input = screen.getByRole("textbox");
        await user.type(input, "Alpha{Escape}");
        expect(input).toHaveValue("");
        expect(input).toHaveFocus();
        expect(
            screen.queryByRole("button", { name: "Clear search" })
        ).not.toBeInTheDocument();
    });
});
