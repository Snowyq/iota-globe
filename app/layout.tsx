import { Geist, Geist_Mono, Lora } from "next/font/google";

import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import GlobeContextProvider from "@/features/globe/GlobeContext";
import NetworkContextProvider from "@/features/network/NetworkContext";
import OptionsContextProvider from "@/features/options/OptionsContext";
import ValidatorsContextProvider from "@/features/validators/ValidatorsContext";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/views/AppLayout";
import "./globals.css";

const loraHeading = Lora({ subsets: ["latin"], variable: "--font-heading" });

const fontSans = Geist({
    subsets: ["latin"],
    variable: "--font-sans",
});

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontSans.variable,
                "font-mono",
                geistMono.variable,
                loraHeading.variable
            )}
        >
            <body suppressHydrationWarning>
                {/* Context Providers hell */}
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
