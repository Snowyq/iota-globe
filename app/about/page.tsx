import AboutPage from "@/features/about/AboutPage";
import type { Metadata } from "next";
import "./about.css";

const description =
    "How IOTA Globe works: a worker-rendered globe of IOTA validators fed by a live checkpoint stream.";

export const metadata: Metadata = {
    title: "About",
    description,
    openGraph: {
        title: "About IOTA Globe",
        description,
        url: "/about",
    },
    twitter: {
        card: "summary_large_image",
        title: "About IOTA Globe",
        description,
    },
};

export default function Page() {
    return <AboutPage />;
}
