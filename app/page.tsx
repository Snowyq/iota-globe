import Index from "@/views/Index";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: { absolute: "IOTA Globe — Network Observatory" },
    description:
        "Explore IOTA in real time. Discover validators around the world, network activity, staking and epoch analytics.",
};

export default function Page() {
    return <Index />;
}
