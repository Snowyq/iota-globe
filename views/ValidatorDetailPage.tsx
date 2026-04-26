"use client";

import { Page } from "@/components/Page";
import { useParams } from "next/navigation";

export default function ValidatorDetailPage() {
    const { id } = useParams<{ id: string }>();

    return (
        <Page>
            <>{/* To do */}</>
        </Page>
    );
}
