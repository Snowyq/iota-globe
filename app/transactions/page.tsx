import TransactionsPage from "@/views/TransactionsPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transactions" };

export default function Page() {
    return <TransactionsPage />;
}
