import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionsPage from "@/views/TransactionsPage";
import type { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { TestNetwork } from "../helpers/providers";
import { installEventSource, TestEventSource } from "../helpers/eventSource";

vi.mock("@/features/dashboard/ThroughputChart", () => ({
    ThroughputChart: () => null,
}));
beforeEach(() => {
    installEventSource();
});
const transaction = (
    digest: string,
    overrides: Partial<TransactionStreamItem> = {}
): TransactionStreamItem => ({
    digest,
    sender: "0xalice",
    isSystem: false,
    txnsCount: 2,
    gasIOTA: 0.002,
    timestampMs: String(Date.now()),
    checkpoint: "1000",
    ...overrides,
});

describe("transaction feed", () => {
    it("freezes the visible snapshot while paused and shows buffered activity on resume", async () => {
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <TransactionsPage />
            </TestNetwork>
        );
        const source = TestEventSource.instances[0];
        act(() => source.emit(transaction("tx-first")));
        expect(screen.getByText("tx-first")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Pause feed" }));
        act(() => source.emit(transaction("tx-new")));
        expect(screen.queryByText("tx-new")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Resume" }));
        expect(screen.getByText("tx-new")).toBeInTheDocument();
        expect(screen.getByText("tx-first")).toBeInTheDocument();
    });
    it("combines transaction type filtering with digest and sender searches", async () => {
        const user = userEvent.setup();
        render(
            <TestNetwork>
                <TransactionsPage />
            </TestNetwork>
        );
        const source = TestEventSource.instances[0];
        act(() => {
            source.emit(transaction("tx-user"));
            source.emit(
                transaction("tx-system", {
                    isSystem: true,
                    sender: "0x0",
                    gasIOTA: 0,
                })
            );
        });
        await user.click(screen.getByRole("button", { name: "User" }));
        expect(screen.queryByText("tx-system")).not.toBeInTheDocument();
        const search = screen.getByRole("textbox", {
            name: "Search by transaction digest or sender",
        });
        await user.type(search, "0xalice");
        expect(screen.getByText("tx-user")).toBeInTheDocument();
        await user.clear(search);
        await user.type(search, "does-not-exist");
        expect(
            screen.getByText("No transactions match your search.")
        ).toBeInTheDocument();
    });
    it("deduplicates received events", () => {
        render(
            <TestNetwork>
                <TransactionsPage />
            </TestNetwork>
        );
        const source = TestEventSource.instances[0];
        act(() => {
            source.emit(transaction("tx-duplicate"));
            source.emit(transaction("tx-duplicate"));
        });
        expect(screen.getAllByText("tx-duplicate")).toHaveLength(1);
    });
});
