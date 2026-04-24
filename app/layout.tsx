import { Geist, Geist_Mono, Lora } from "next/font/google";

import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import GlobeContextProvider from "@/features/globe/GlobeContext";
import ValidatorsContextProvider from "@/features/iota/ValidatorsContext";
import OptionsContextProvider from "@/features/options/OptionsContext";
import { cn } from "@/lib/utils";
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
            <body>
                <OptionsContextProvider>
                    <ValidatorsContextProvider>
                        <GlobeContextProvider>
                            <ThemeProvider>
                                <Navigation />
                                <>{children}</>
                            </ThemeProvider>
                        </GlobeContextProvider>
                    </ValidatorsContextProvider>
                </OptionsContextProvider>
            </body>
        </html>
    );
}
