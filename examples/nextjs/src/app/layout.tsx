import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "esptool-react - ESP Device Programming in the Browser",
    description:
        "Program ESP32 and ESP8266 devices directly from your browser using WebSerial. A React library for ESPTool functionality with full TypeScript support.",
    keywords: ["ESP32", "ESP8266", "ESPTool", "React", "WebSerial", "firmware", "programming", "IoT"],
    authors: [{ name: "esptool-react" }],
    creator: "esptool-react",
    publisher: "esptool-react",
    metadataBase: new URL("https://esptool-react.com"),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: "esptool-react - ESP Device Programming in the Browser",
        description:
            "Program ESP32 and ESP8266 devices directly from your browser using WebSerial. A React library for ESPTool functionality with full TypeScript support.",
        url: "https://esptool-react.com",
        siteName: "esptool-react",
        type: "website",
        locale: "en_US",
    },
    twitter: {
        card: "summary_large_image",
        title: "esptool-react - ESP Device Programming in the Browser",
        description:
            "Program ESP32 and ESP8266 devices directly from your browser using WebSerial. A React library for ESPTool functionality with full TypeScript support.",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
        },
    },
    verification: {
        google: undefined, // Add Google Search Console verification ID if needed
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <TooltipProvider>{children}</TooltipProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
