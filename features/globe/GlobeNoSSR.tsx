"use client";

import dynamic from "next/dynamic";

export const GlobeNoSSR = dynamic(
    () => import("@/features/globe/Globe").then((m) => m.Globe),
    { ssr: false }
);
