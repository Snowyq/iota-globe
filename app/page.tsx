import Index from "@/views/Index";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "IOTA Globe",
    description: "Feel free to explore IOTA network with 3D globe",
};

export default function Page() {
    return <Index />;
}
