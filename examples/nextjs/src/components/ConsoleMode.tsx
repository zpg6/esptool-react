"use client";

import { useEspLoader } from "esptool-react";
import {
    AlertCircle,
    AlignJustify,
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    Loader2,
    Maximize,
    MousePointer2,
    Play,
    Square,
    Trash2,
    Type,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseANSI, stylesToCSS } from "../lib/ansiParser";
import { FullscreenConsole } from "./FullscreenConsole";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

export const ConsoleMode: React.FC = () => {
    const { state, actions } = useEspLoader();
    const terminalRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [hexMode, setHexMode] = useState(false);
    const [showControlChars, setShowControlChars] = useState(false);
    const [selectedCharCount, setSelectedCharCount] = useState(0);
    const [justCopied, setJustCopied] = useState(false);

    // Handle text selection to track selected character count
    const handleSelectionChange = useCallback(() => {
        const selection = window.getSelection();
        if (selection && terminalRef.current && terminalRef.current.contains(selection.anchorNode)) {
            const selectedText = selection.toString();
            setSelectedCharCount(selectedText.length);
        } else {
            setSelectedCharCount(0);
        }
    }, []);

    // Add selection event listeners
    useEffect(() => {
        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [handleSelectionChange]);

    // Convert text to hex representation
    const convertToHex = useCallback((text: string) => {
        const bytes = new TextEncoder().encode(text);
        const hexLines: string[] = [];

        for (let i = 0; i < bytes.length; i += 16) {
            const chunk = bytes.slice(i, i + 16);
            const offset = i.toString(16).padStart(4, "0").toUpperCase();

            // Convert bytes to hex string
            const hexBytes = Array.from(chunk)
                .map(b => b.toString(16).padStart(2, "0").toUpperCase())
                .join(" ");

            // Pad hex bytes to consistent width (16 bytes = 47 chars with spaces)
            const paddedHex = hexBytes.padEnd(47, " ");

            // Convert bytes to ASCII representation
            const ascii = Array.from(chunk)
                .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
                .join("");

            hexLines.push(`${offset}: ${paddedHex} |${ascii}|`);
        }

        return hexLines.join("\n");
    }, []);

    // Scroll to bottom function - optimized for minimal latency
    const scrollToBottom = useCallback((smooth = true) => {
        if (terminalRef.current) {
            terminalRef.current.scrollTo({
                top: terminalRef.current.scrollHeight,
                behavior: smooth ? "smooth" : "instant",
            });
        }
    }, []);

    // Scroll to top function
    const scrollToTop = useCallback(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTo({
                top: 0,
                behavior: "instant",
            });
        }
    }, []);

    // Auto-scroll when new content arrives - instant with no animation
    useEffect(() => {
        if (autoScrollEnabled && state.terminalOutput.length > 0) {
            // Use requestAnimationFrame for immediate next-frame execution
            requestAnimationFrame(() => {
                scrollToBottom(false); // false = instant scroll, no animation
            });
        }
    }, [state.terminalOutput, autoScrollEnabled, scrollToBottom]);

    // Intersection Observer for reliable scroll detection
    useEffect(() => {
        if (!terminalRef.current || !topSentinelRef.current || !bottomSentinelRef.current) return;

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.target === topSentinelRef.current) {
                        setIsAtTop(entry.isIntersecting);
                    } else if (entry.target === bottomSentinelRef.current) {
                        setIsAtBottom(entry.isIntersecting);
                    }
                });
            },
            {
                root: terminalRef.current,
                rootMargin: "0px",
                threshold: 0.1,
            }
        );

        observer.observe(topSentinelRef.current);
        observer.observe(bottomSentinelRef.current);

        return () => observer.disconnect();
    }, [state.terminalOutput]);

    // Fallback scroll detection for edge cases
    const handleScroll = useCallback(() => {
        if (!terminalRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        const isScrollable = scrollHeight > clientHeight;

        if (!isScrollable) {
            setIsAtTop(true);
            setIsAtBottom(true);
        }
    }, []);

    // Handle ESC key for fullscreen exit
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (isFullscreen) {
            document.addEventListener("keydown", handleKeyPress);
            return () => document.removeEventListener("keydown", handleKeyPress);
        }
    }, [isFullscreen]);

    const handleToggleConsole = useCallback(async () => {
        if (state.isConsoleConnected) {
            await actions.stopConsole();
        } else {
            await actions.startConsole();
        }
    }, [state.isConsoleConnected, actions]);

    const handleClearTerminal = useCallback(() => {
        actions.clearTerminal();
        setAutoScrollEnabled(true);
    }, [actions]);

    const toggleAutoScroll = useCallback(() => {
        setAutoScrollEnabled(prev => {
            const newValue = !prev;
            if (newValue) {
                // Immediate scroll when enabling autoscroll
                requestAnimationFrame(() => scrollToBottom(false));
            }
            return newValue;
        });
    }, [scrollToBottom]);

    const toggleHexMode = useCallback(() => {
        setHexMode(prev => {
            const newHexMode = !prev;
            // Disable control chars when entering hex mode
            if (newHexMode && showControlChars) {
                setShowControlChars(false);
            }
            return newHexMode;
        });
    }, [showControlChars]);

    const toggleControlChars = useCallback(() => {
        setShowControlChars(prev => !prev);
    }, []);

    const selectAllText = useCallback(() => {
        if (terminalRef.current) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(terminalRef.current);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }, []);

    const copyAllText = useCallback(async () => {
        try {
            const allText = state.terminalOutput.join("\n");
            await navigator.clipboard.writeText(allText);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
        } catch (err) {
            console.warn("Failed to copy text to clipboard:", err);
        }
    }, [state.terminalOutput]);

    // Handle hotkeys for console controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger hotkeys if user is typing in an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ctrl+Enter or Space: Toggle console connection
            if ((e.ctrlKey && e.key === "Enter") || e.key === " ") {
                e.preventDefault();
                handleToggleConsole();
                return;
            }

            // Ctrl+K: Clear terminal
            if (e.ctrlKey && e.key === "k") {
                e.preventDefault();
                handleClearTerminal();
                return;
            }

            // Ctrl+E: Toggle auto-scroll
            if (e.ctrlKey && e.key === "e") {
                e.preventDefault();
                toggleAutoScroll();
                return;
            }

            // Ctrl+Up: Scroll to top
            if (e.ctrlKey && e.key === "ArrowUp") {
                e.preventDefault();
                scrollToTop();
                return;
            }

            // Ctrl+Down: Scroll to bottom
            if (e.ctrlKey && e.key === "ArrowDown") {
                e.preventDefault();
                scrollToBottom(false);
                return;
            }

            // Ctrl+H: Toggle hex mode
            if (e.ctrlKey && e.key === "h") {
                e.preventDefault();
                toggleHexMode();
                return;
            }

            // Ctrl+L: Toggle control characters visibility (disabled in hex mode)
            if (e.ctrlKey && e.key === "l") {
                e.preventDefault();
                if (!hexMode) {
                    toggleControlChars();
                }
                return;
            }

            // F11 or Ctrl+F: Toggle fullscreen
            if (e.key === "F11" || (e.ctrlKey && e.key === "f")) {
                e.preventDefault();
                setIsFullscreen(true);
                return;
            }

            // Ctrl+A: Select all text
            if (e.ctrlKey && e.key === "a") {
                e.preventDefault();
                selectAllText();
                return;
            }

            // Ctrl+C: Copy all text
            if (e.ctrlKey && e.key === "c") {
                e.preventDefault();
                copyAllText();
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
        handleToggleConsole,
        handleClearTerminal,
        toggleAutoScroll,
        scrollToTop,
        scrollToBottom,
        toggleHexMode,
        toggleControlChars,
        selectAllText,
        copyAllText,
        hexMode,
    ]);

    // Memoize line and character counts for performance
    const terminalStats = useMemo(() => {
        if (state.terminalOutput.length === 0) {
            return { lineCount: 0, charCount: 0 };
        }

        let totalLines = 0;
        let totalChars = 0;

        state.terminalOutput.forEach(entry => {
            // Count actual lines by splitting on newlines
            const lines = entry.split("\n");
            totalLines += lines.length;
            totalChars += entry.length;
        });

        return { lineCount: totalLines, charCount: totalChars };
    }, [state.terminalOutput]);

    // Memoize terminal content to avoid unnecessary re-renders
    const terminalContent = useMemo(() => {
        if (state.terminalOutput.length === 0) {
            if (!state.isConsoleConnected) {
                // Show connect button when not connected
                return (
                    <>
                        <div ref={topSentinelRef} className="h-0 w-full" />
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <div className="text-6xl mb-4 opacity-50">🔌</div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">Connect to ESP Device</h3>
                            <p className="text-sm mb-6 text-center max-w-sm">
                                Start the serial monitor to view real-time output from your ESP device
                            </p>
                            <Button
                                onClick={handleToggleConsole}
                                disabled={state.isLoading}
                                variant="default"
                                size="lg"
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {state.isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-2 fill-current" />
                                        Connect
                                    </>
                                )}
                            </Button>
                        </div>
                        <div ref={bottomSentinelRef} className="h-0 w-full" />
                    </>
                );
            } else {
                // Show ready message when connected but no output
                return (
                    <>
                        <div ref={topSentinelRef} className="h-0 w-full" />
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <div className="text-4xl mb-3 opacity-50">📡</div>
                            <p className="text-lg mb-1">Console ready</p>
                            <p className="text-xs opacity-75">Serial output will appear here...</p>
                        </div>
                        <div ref={bottomSentinelRef} className="h-0 w-full" />
                    </>
                );
            }
        }

        return (
            <>
                <div ref={topSentinelRef} className="h-0 w-full" />
                {state.terminalOutput.map((line, lineIndex) => {
                    if (hexMode) {
                        const hexContent = convertToHex(line);
                        return (
                            <div key={lineIndex} className="leading-relaxed text-foreground">
                                <span className="whitespace-pre-wrap font-mono text-sm text-muted-foreground">
                                    {hexContent}
                                </span>
                            </div>
                        );
                    } else {
                        // Process line to show control characters if enabled
                        let processedLine = line;
                        if (showControlChars) {
                            // Use temporary markers to avoid double-processing
                            processedLine = line
                                .replace(/\r\n/g, "__CRLF__") // Mark CRLF pairs temporarily
                                .replace(/\r/g, "␍") // Process standalone CR
                                .replace(/\n/g, "␊\n") // Process standalone LF
                                .replace(/__CRLF__/g, "␍␊\n"); // Restore CRLF with symbols
                        }

                        const segments = parseANSI(processedLine);
                        return (
                            <div key={lineIndex} className="leading-relaxed text-foreground">
                                {segments.map((segment, segmentIndex) => (
                                    <span
                                        key={segmentIndex}
                                        style={stylesToCSS(segment.style)}
                                        className="whitespace-pre-wrap"
                                    >
                                        {segment.text}
                                    </span>
                                ))}
                            </div>
                        );
                    }
                })}
                <div ref={bottomSentinelRef} className="h-0 w-full" />
            </>
        );
    }, [
        state.terminalOutput,
        hexMode,
        showControlChars,
        convertToHex,
        handleToggleConsole,
        state.isLoading,
        state.isConsoleConnected,
    ]);

    if (isFullscreen) {
        return <FullscreenConsole onClose={() => setIsFullscreen(false)} />;
    }

    return (
        <div className="h-full flex flex-col">
            {/* Console Card */}
            <div className="bg-card border border-border rounded-lg shadow-sm h-[600px] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div>
                            <h3 className="text-lg font-semibold">Serial Monitor</h3>
                            <p className="text-xs text-muted-foreground">Real-time ESP device output</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        <Tooltip content="Clear terminal" side="bottom">
                            <Button
                                onClick={handleClearTerminal}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={state.terminalOutput.length === 0}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </Tooltip>

                        <Tooltip content={justCopied ? "Copied!" : "Copy all"} side="bottom">
                            <Button
                                onClick={copyAllText}
                                variant="outline"
                                size="sm"
                                className={`h-8 w-8 p-0 ${justCopied ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" : ""}`}
                                disabled={state.terminalOutput.length === 0}
                            >
                                {justCopied ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </Tooltip>

                        <Tooltip content="Fullscreen" side="bottom">
                            <Button
                                onClick={() => setIsFullscreen(true)}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            >
                                <Maximize className="w-4 h-4" />
                            </Button>
                        </Tooltip>

                        {/* Only show Connect button if there's content or already connected */}
                        {(state.terminalOutput.length > 0 || state.isConsoleConnected) && (
                            <Tooltip
                                content={state.isConsoleConnected ? "Disconnect" : "Connect to ESP Device"}
                                side="bottom"
                            >
                                <Button
                                    onClick={handleToggleConsole}
                                    disabled={state.isLoading}
                                    variant={state.isConsoleConnected ? "destructive" : "default"}
                                    size="sm"
                                    className={`h-8 px-3 ${state.isConsoleConnected ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                                >
                                    {state.isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Connecting...
                                        </>
                                    ) : state.isConsoleConnected ? (
                                        <Square className="w-4 h-4 fill-current" />
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2 fill-current" />
                                            Connect
                                        </>
                                    )}
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Terminal Area */}
                <div className="flex-1 bg-muted/20 relative min-h-0">
                    <div
                        ref={terminalRef}
                        onScroll={handleScroll}
                        className="absolute inset-0 overflow-y-auto terminal-content p-4 font-mono text-sm"
                    >
                        {terminalContent}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border text-sm text-muted-foreground flex-shrink-0">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-2 lg:space-y-0">
                        {/* Status Information */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="flex items-center space-x-1">
                                <AlignJustify className="w-4 h-4" />
                                <span>Lines: {terminalStats.lineCount}</span>
                            </span>

                            <span className="flex items-center space-x-1">
                                <Type className="w-4 h-4" />
                                <span>Chars: {terminalStats.charCount.toLocaleString()}</span>
                            </span>

                            {!hexMode && (
                                <span className="flex items-center space-x-1">
                                    <MousePointer2 className="w-4 h-4" />
                                    <span>Selected: {selectedCharCount}</span>
                                </span>
                            )}

                            <span className="flex items-center space-x-1 text-muted-foreground/75">
                                <span>{state.consoleBaudrate.toLocaleString()} baud</span>
                            </span>

                            <span className="flex items-center space-x-1 text-muted-foreground/75">
                                <span>
                                    {state.consoleDataBits}
                                    {state.consoleParity === "none" ? "N" : state.consoleParity.charAt(0).toUpperCase()}
                                    {state.consoleStopBits}
                                </span>
                            </span>

                            {state.error && (
                                <span className="text-destructive flex items-center space-x-1">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{state.error.toString()}</span>
                                </span>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <button
                                onClick={toggleHexMode}
                                className="flex items-center space-x-1 hover:text-foreground transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${hexMode ? "bg-purple-500" : "bg-muted-foreground"}`}
                                ></span>
                                <span>{hexMode ? "HEX" : "TEXT"}</span>
                            </button>

                            <button
                                onClick={toggleControlChars}
                                disabled={hexMode}
                                className={`flex items-center space-x-1 transition-colors cursor-pointer rounded px-1 py-0.5 ${hexMode ? "opacity-50 cursor-not-allowed" : "hover:text-foreground hover:bg-accent"}`}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${showControlChars ? "bg-orange-500" : "bg-muted-foreground"}`}
                                ></span>
                                <span>CR/LF {showControlChars ? "ON" : "OFF"}</span>
                            </button>

                            <div className="flex items-center space-x-1 lg:ml-2 lg:pl-2 lg:border-l lg:border-border">
                                <button
                                    onClick={toggleAutoScroll}
                                    className="flex items-center space-x-1 hover:text-foreground transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-accent mr-2"
                                >
                                    <span
                                        className={`w-2 h-2 rounded-full ${autoScrollEnabled ? "bg-blue-500" : "bg-muted-foreground"}`}
                                    ></span>
                                    <span>Auto-scroll {autoScrollEnabled ? "ON" : "OFF"}</span>
                                </button>
                                <button
                                    onClick={scrollToTop}
                                    disabled={isAtTop || state.terminalOutput.length === 0}
                                    className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => scrollToBottom(false)}
                                    disabled={isAtBottom || state.terminalOutput.length === 0}
                                    className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
