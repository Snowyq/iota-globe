"use client";

import dynamic from "next/dynamic";
import { GlobeSkeleton } from "./GlobeSkeleton";

export const GlobeNoSSR = dynamic(
    () => import("@/features/globe/Globe").then((m) => m.Globe),
    { ssr: false, loading: () => <GlobeSkeleton /> }
);
