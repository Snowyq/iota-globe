import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { ValidatorSearch } from "@/features/globe/ValidatorSearch";
import { useValidatorLink } from "@/features/globe/useValidatorLink";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { validator } from "../helpers/fixtures";
import { globeContext, validatorsContext } from "../helpers/providers";

const swiss = validator({
    iotaAddress: "0x5w155",
    payload: { name: "Swiss IOTA" },
});
const alpha = validator({
    iotaAddress: "0xa1fa",
    payload: { name: "Alpha Swiss" },
});
const noswiss = validator({
    iotaAddress: "0x0005",
    payload: { name: "Noswiss" },
});
const beef = validator({
    iotaAddress: "0xbeef01",
    payload: { name: "Kiln" },
    geo: {
        country: "France",
        countryCode: "FR",
        region: "IDF",
        regionName: "Île-de-France",
        city: "Paris",
        zip: "75001",
        lat: 48.85,
        lon: 2.35,
        timezone: "Europe/Paris",
        query: "203.0.113.9",
    },
});
const all = [swiss, alpha, noswiss, beef];

function setup(
    ui: ReactNode,
    validators = validatorsContext({ validators: all }),
    globe = globeContext()
) {
    const view = render(
        <ValidatorsContext value={validators}>
            <GlobeContext value={globe}>{ui}</GlobeContext>
        </ValidatorsContext>
    );
    const rerender = (next: ReactNode) =>
        view.rerender(
            <ValidatorsContext value={validators}>
                <GlobeContext value={globe}>{next}</GlobeContext>
            </ValidatorsContext>
        );
    return { ...view, rerender, validators, globe };
}

const names = () =>
    within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.querySelector("strong")?.textContent);

describe("ValidatorSearch", () => {
    it("ranks name matches and finds by address or place", async () => {
        setup(<ValidatorSearch onClose={vi.fn()} />);
        const input = screen.getByRole("combobox");
        // Name start, then word start, then anywhere.
        await userEvent.type(input, "swi");
        expect(names()).toEqual(["Swiss IOTA", "Alpha Swiss", "Noswiss"]);
        await userEvent.clear(input);
        await userEvent.type(input, "0xbeef");
        expect(names()).toEqual(["Kiln"]);
        await userEvent.clear(input);
        await userEvent.type(input, "paris");
        expect(names()).toEqual(["Kiln"]);
    });

    it("picks a result with the keyboard and flies to it", async () => {
        const onClose = vi.fn();
        const { validators, globe } = setup(
            <ValidatorSearch onClose={onClose} />
        );
        const input = screen.getByRole("combobox");
        expect(input).toHaveFocus();
        await userEvent.type(input, "swi");
        await userEvent.keyboard("{ArrowDown}");
        expect(
            screen.getByRole("option", { selected: true })
        ).toHaveTextContent("Alpha Swiss");
        await userEvent.keyboard("{Enter}");
        expect(globe.setOpenClusterId).toHaveBeenCalledWith(null);
        expect(validators.selectValidator).toHaveBeenCalledWith("0xa1fa");
        expect(globe.moveGlobeTo).toHaveBeenCalledWith(52.23, 21.01, 1.5);
        expect(onClose).toHaveBeenCalled();
    });
});

function Linked({ ready }: { ready: boolean }) {
    useValidatorLink(ready);
    return null;
}

describe("useValidatorLink", () => {
    beforeEach(() => window.history.replaceState(null, "", "/"));

    it("opens a linked validator once the globe is ready", () => {
        window.history.replaceState(null, "", "/?validator=0xBEEF01");
        const { rerender, validators, globe } = setup(<Linked ready={false} />);
        expect(validators.selectValidator).not.toHaveBeenCalled();
        rerender(<Linked ready />);
        expect(globe.setOpenClusterId).toHaveBeenCalledWith(null);
        expect(validators.selectValidator).toHaveBeenCalledWith("0xbeef01");
        expect(globe.moveGlobeTo).toHaveBeenCalledWith(48.85, 2.35, 1.5);
    });

    it("drops a link to an unknown validator", () => {
        window.history.replaceState(null, "", "/?validator=0xdead&x=1");
        const { validators } = setup(<Linked ready />);
        expect(validators.selectValidator).not.toHaveBeenCalled();
        expect(window.location.search).toBe("?x=1");
    });
});
