import ValidatorDetailPage from "@/views/ValidatorDetailPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validator details" };

export default function Page() {
    return <ValidatorDetailPage />;
}
