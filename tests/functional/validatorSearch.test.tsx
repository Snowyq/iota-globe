import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { ValidatorSearch } from "@/features/globe/ValidatorSearch";
import {
    useValidatorLink,
    validatorLink,
} from "@/features/globe/useValidatorLink";
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
    const rerender = (
        next: ReactNode,
        nextValidators = validators,
        nextGlobe = globe
    ) =>
        view.rerender(
            <ValidatorsContext value={nextValidators}>
                <GlobeContext value={nextGlobe}>{next}</GlobeContext>
            </ValidatorsContext>
        );
    return { ...view, rerender, validators, globe };
}

const names = () =>
    within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.querySelector("strong")?.textContent);

describe("validator search palette", () => {
    it("ranks a name's start, then a word's start, then anywhere in the name", async () => {
        setup(<ValidatorSearch onClose={vi.fn()} />);
        await userEvent.type(screen.getByRole("combobox"), "swi");
        expect(names()).toEqual(["Swiss IOTA", "Alpha Swiss", "Noswiss"]);
    });

    it("finds a validator by address or by place", async () => {
        setup(<ValidatorSearch onClose={vi.fn()} />);
        const input = screen.getByRole("combobox");
        await userEvent.type(input, "0xbeef");
        expect(names()).toEqual(["Kiln"]);
        await userEvent.clear(input);
        await userEvent.type(input, "paris");
        expect(names()).toEqual(["Kiln"]);
    });

    it("moves with the arrows and flies to the chosen validator on Enter", async () => {
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

    it("says so when nothing matches, and closes on Escape", async () => {
        const onClose = vi.fn();
        setup(<ValidatorSearch onClose={onClose} />);
        await userEvent.type(screen.getByRole("combobox"), "zzz");
        expect(
            screen.getByText("No validator matches “zzz”.")
        ).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalled();
    });
});

function Linked({ ready }: { ready: boolean }) {
    useValidatorLink(ready);
    return null;
}

describe("link to a validator", () => {
    beforeEach(() => window.history.replaceState(null, "", "/"));

    it("builds a link that opens the overview on one validator", () => {
        expect(validatorLink("0xbeef01", "https://iota-globe.vercel.app")).toBe(
            "https://iota-globe.vercel.app/?validator=0xbeef01"
        );
    });

    it("opens the linked validator once the globe is ready, whatever the address's case", () => {
        window.history.replaceState(null, "", "/?validator=0xBEEF01");
        const { rerender, validators, globe } = setup(<Linked ready={false} />);
        expect(validators.selectValidator).not.toHaveBeenCalled();
        rerender(<Linked ready />);
        expect(globe.setOpenClusterId).toHaveBeenCalledWith(null);
        expect(validators.selectValidator).toHaveBeenCalledWith("0xbeef01");
        expect(globe.moveGlobeTo).toHaveBeenCalledWith(48.85, 2.35, 1.5);
    });

    it("waits for the validator list before giving up on the link", () => {
        window.history.replaceState(null, "", "/?validator=0xbeef01");
        const empty = validatorsContext({ validators: [] });
        const { rerender, globe } = setup(<Linked ready />, empty);
        expect(window.location.search).toBe("?validator=0xbeef01");
        const loaded = validatorsContext({ validators: all });
        rerender(<Linked ready />, loaded, globe);
        expect(loaded.selectValidator).toHaveBeenCalledWith("0xbeef01");
    });

    it("drops a link to a validator that is not in the set", () => {
        window.history.replaceState(null, "", "/?validator=0xdead&x=1");
        const { validators } = setup(<Linked ready />);
        expect(validators.selectValidator).not.toHaveBeenCalled();
        expect(window.location.search).toBe("?x=1");
    });

    it("keeps the address in step with the open validator", () => {
        const { rerender, globe } = setup(<Linked ready />);
        rerender(
            <Linked ready />,
            validatorsContext({ validators: all, selectedValidator: alpha }),
            globe
        );
        expect(window.location.search).toBe("?validator=0xa1fa");
        rerender(
            <Linked ready />,
            validatorsContext({ validators: all, selectedValidator: null }),
            globe
        );
        expect(window.location.search).toBe("");
    });
});
