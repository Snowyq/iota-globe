import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { NetworkLiveCard } from "@/features/network/NetworkLiveCard";
import { TestNetwork } from "../helpers/providers";
import { installEventSource, TestEventSource } from "../helpers/eventSource";

beforeEach(() => {
    installEventSource();
});
const tx = (id: string) => ({
    digest: id,
    sender: "0xalice",
    isSystem: false,
    txnsCount: 2,
    gasIOTA: 0.002,
    timestampMs: String(Date.now()),
    checkpoint: "100",
});

describe("live activity reading position", () => {
    it("keeps new activity at the top until the reader scrolls away", () => {
        render(
            <TestNetwork>
                <NetworkLiveCard />
            </TestNetwork>
        );
        act(() => {
            TestEventSource.instances[0].emit(tx("tx-first"));
            TestEventSource.instances[0].emit(tx("tx-second"));
        });
        expect(screen.getByText("At latest")).toBeInTheDocument();
        const list = screen.getByRole("region", {
            name: "Live activity events",
        });
        expect(
            within(list)
                .getByText("tx-second")
                .compareDocumentPosition(within(list).getByText("tx-first")) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
    it("holds visible rows, deduplicates incoming events and resumes at the newest record", async () => {
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <NetworkLiveCard />
            </TestNetwork>
        );
        const source = TestEventSource.instances[0];
        act(() => source.emit(tx("tx-first")));
        const list = screen.getByRole("region", {
            name: "Live activity events",
        });
        fireEvent.scroll(list, { target: { scrollTop: 90 } });
        expect(screen.getByText("Reading history")).toBeInTheDocument();
        act(() => {
            source.emit(tx("tx-new"));
            source.emit(tx("tx-new"));
        });
        expect(within(list).queryByText("tx-new")).not.toBeInTheDocument();
        expect(within(list).getByText("tx-first")).toBeInTheDocument();
        expect(list.scrollTop).toBe(90);
        await user.click(screen.getByRole("button", { name: "1 new event" }));
        expect(within(list).getByText("tx-new")).toBeInTheDocument();
        expect(list.scrollTop).toBe(0);
        expect(screen.getByText("At latest")).toBeInTheDocument();
    });
    it("resumes when scrolling to the top and resets reading state when changing tabs", async () => {
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <NetworkLiveCard />
            </TestNetwork>
        );
        const list = screen.getByRole("region", {
            name: "Live activity events",
        });
        act(() => TestEventSource.instances[0].emit(tx("tx-first")));
        fireEvent.scroll(list, { target: { scrollTop: 100 } });
        act(() => TestEventSource.instances[0].emit(tx("tx-new")));
        fireEvent.scroll(list, { target: { scrollTop: 0 } });
        expect(within(list).getByText("tx-new")).toBeInTheDocument();
        fireEvent.scroll(list, { target: { scrollTop: 100 } });
        await user.click(screen.getByRole("button", { name: "Checkpoints" }));
        expect(screen.getByText("At latest")).toBeInTheDocument();
        expect(list.scrollTop).toBe(0);
        act(() =>
            TestEventSource.instances[1].emit({
                sequenceNumber: "101",
                txCount: 2,
                timestampMs: String(Date.now()),
                epoch: "42",
            })
        );
        expect(within(list).getByText("#101")).toBeInTheDocument();
    });
    it("clears buffered activity and unread count when switching networks", () => {
        const { rerender } = render(
            <TestNetwork>
                <NetworkLiveCard />
            </TestNetwork>
        );
        act(() => TestEventSource.instances[0].emit(tx("tx-old")));
        fireEvent.scroll(
            screen.getByRole("region", { name: "Live activity events" }),
            { target: { scrollTop: 100 } }
        );
        act(() => TestEventSource.instances[0].emit(tx("tx-pending")));
        rerender(
            <TestNetwork network="testnet">
                <NetworkLiveCard />
            </TestNetwork>
        );
        expect(screen.queryByText("tx-old")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /new event/ })
        ).not.toBeInTheDocument();
        expect(screen.getByText("At latest")).toBeInTheDocument();
    });
});
