import { Archivo, JetBrains_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";

import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import GlobeContextProvider from "@/features/globe/GlobeContext";
import NetworkContextProvider from "@/features/network/NetworkContext";
import { CheckpointStreamProvider } from "@/features/network/CheckpointStream";
import OptionsContextProvider from "@/features/options/OptionsContext";
import ValidatorsContextProvider from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/views/AppLayout";
import "./globals.css";

// OG images need absolute URLs; previews fall back to the Vercel host.
const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://iota-globe.vercel.app");

const description =
    "Explore IOTA validators, live network activity, staking and epoch analytics.";

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: "IOTA Globe — Network Observatory",
        template: "%s | IOTA Globe",
    },
    description,
    openGraph: {
        type: "website",
        siteName: "IOTA Globe",
        title: "IOTA Globe — Network Observatory",
        description,
        url: "/",
    },
    twitter: {
        card: "summary_large_image",
        title: "IOTA Globe — Network Observatory",
        description,
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#0b0f11",
    colorScheme: "dark",
};

// Width axis: normal for text, expanded for display type.
const fontSans = Archivo({
    subsets: ["latin"],
    axes: ["wdth"],
    variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn("antialiased", fontSans.variable, fontMono.variable)}
        >
            <body suppressHydrationWarning>
                <OptionsContextProvider>
                    <NetworkContextProvider>
                        <CheckpointStreamProvider>
                            <ValidatorsContextProvider>
                                <GlobeContextProvider>
                                    <ThemeProvider>
                                        <Navigation />
                                        <AppLayout>{children}</AppLayout>
                                    </ThemeProvider>
                                </GlobeContextProvider>
                            </ValidatorsContextProvider>
                        </CheckpointStreamProvider>
                    </NetworkContextProvider>
                </OptionsContextProvider>
            </body>
        </html>
    );
}
