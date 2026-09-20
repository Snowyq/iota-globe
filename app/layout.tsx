import { Archivo, JetBrains_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";

import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import GlobeContextProvider from "@/features/globe/GlobeContext";
import NetworkContextProvider from "@/features/network/NetworkContext";
import OptionsContextProvider from "@/features/options/OptionsContext";
import ValidatorsContextProvider from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/views/AppLayout";
import "./globals.css";

export const metadata: Metadata = {
    title: {
        default: "IOTA Globe — Network Observatory",
        template: "%s | IOTA Globe",
    },
    description:
        "Explore IOTA validators, live network activity, staking and epoch analytics.",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#0b0f11",
    colorScheme: "dark",
};

// Archivo carries a width axis: normal width for text, expanded for display.
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
                        <ValidatorsContextProvider>
                            <GlobeContextProvider>
                                <ThemeProvider>
                                    <Navigation />
                                    <AppLayout>{children}</AppLayout>
                                </ThemeProvider>
                            </GlobeContextProvider>
                        </ValidatorsContextProvider>
                    </NetworkContextProvider>
                </OptionsContextProvider>
            </body>
        </html>
    );
}
