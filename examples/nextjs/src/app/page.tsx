"use client";

import ESPDevelopmentConsole from "@/components/ESPDevelopmentConsole";
import { ESPLoaderProvider } from "esptool-react";
import { Github, Package, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import SparkMD5 from "spark-md5";

export default function HomePage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    // Function to calculate MD5 hash as expected by esptool-js
    const calculateMD5Hash = (image: Uint8Array): string => {
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(image.buffer as ArrayBuffer);
        return spark.end();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gradient-to-r from-sky-600 to-blue-600 rounded-lg flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 dark:from-sky-400 dark:via-sky-300 dark:to-blue-400 bg-clip-text text-transparent">
                                        esptool-react
                                    </h1>
                                    <p className="text-xs text-muted-foreground -mt-1">
                                        ESP Device Programming in Browser
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {/* GitHub and npm links */}
                            <div className="flex items-center space-x-1 border border-border/40 rounded-lg p-1 bg-secondary/30 backdrop-blur-sm">
                                <a
                                    href="https://github.com/zpg6/esptool-react"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-secondary/80 transition-all duration-200 text-sm font-medium text-muted-foreground hover:text-foreground group"
                                    aria-label="View on GitHub"
                                >
                                    <Github className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                                    <span className="hidden sm:inline">GitHub</span>
                                </a>
                                <div className="w-px h-4 bg-border/40" />
                                <a
                                    href="https://www.npmjs.com/package/esptool-react"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-secondary/80 transition-all duration-200 text-sm font-medium text-muted-foreground hover:text-foreground group"
                                    aria-label="View on npm"
                                >
                                    <Package className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                                    <span className="hidden sm:inline">npm</span>
                                </a>
                            </div>

                            {/* Theme toggle */}
                            <button
                                onClick={toggleTheme}
                                className="relative p-2 rounded-lg bg-secondary/80 hover:bg-secondary transition-colors duration-200 border border-border/40"
                                aria-label="Toggle theme"
                            >
                                <div className="w-5 h-5 relative">
                                    {!mounted ? (
                                        // Fallback icon during hydration
                                        <svg
                                            className="w-5 h-5 text-muted-foreground"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                        </svg>
                                    ) : resolvedTheme === "dark" ? (
                                        <svg
                                            className="w-5 h-5 text-yellow-500"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <ESPLoaderProvider
                    calculateMD5Hash={calculateMD5Hash}
                    initialBaudrate={115200}
                    initialConsoleBaudrate={115200}
                    initialDebugLogging={false}
                    initialRomBaudrate={115200}
                >
                    <ESPDevelopmentConsole />
                </ESPLoaderProvider>
            </main>
        </div>
    );
}
