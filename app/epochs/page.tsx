import EpochsPage from "@/views/EpochsPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Epoch history" };

export default function Page() {
    return <EpochsPage />;
}
