"use client";

import { useEspLoader } from "esptool-react";
import { Info } from "lucide-react";
import React from "react";

export const Settings: React.FC = () => {
    const { state, actions } = useEspLoader();

    // Settings controls
    const handleBaudrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setBaudrate(parseInt(e.target.value));
    };

    const handleConsoleBaudrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setConsoleBaudrate(parseInt(e.target.value));
    };

    const handleConsoleDataBitsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setConsoleDataBits(parseInt(e.target.value) as 7 | 8);
    };

    const handleConsoleStopBitsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setConsoleStopBits(parseInt(e.target.value) as 1 | 2);
    };

    const handleConsoleParityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setConsoleParity(e.target.value as "none" | "even" | "odd");
    };

    const handleDebugLoggingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setDebugLogging(e.target.checked);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Programming Settings */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">
                    Programming Settings
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Programming Baudrate</label>
                        <select
                            value={state.baudrate}
                            onChange={handleBaudrateChange}
                            className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        >
                            <option value="115200">115200</option>
                            <option value="230400">230400</option>
                            <option value="460800">460800</option>
                            <option value="921600">921600</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                            Higher speeds may require better USB connections. Start with 115200 for reliability.
                        </p>
                    </div>
                </div>
            </div>

            {/* Console Settings */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">
                    Console Settings
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Console Baudrate</label>
                        <select
                            value={state.consoleBaudrate}
                            onChange={handleConsoleBaudrateChange}
                            className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        >
                            <option value="1200">1200</option>
                            <option value="2400">2400</option>
                            <option value="4800">4800</option>
                            <option value="9600">9600</option>
                            <option value="19200">19200</option>
                            <option value="38400">38400</option>
                            <option value="57600">57600</option>
                            <option value="74880">74880 (ESP Boot Debug)</option>
                            <option value="115200">115200</option>
                            <option value="230400">230400</option>
                            <option value="460800">460800</option>
                            <option value="921600">921600</option>
                            <option value="1000000">1000000</option>
                            <option value="1500000">1500000</option>
                            <option value="2000000">2000000</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                            Must match your device's serial output baudrate. 115200 is most common.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Data Bits</label>
                            <select
                                value={state.consoleDataBits}
                                onChange={handleConsoleDataBitsChange}
                                className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            >
                                <option value="7">7</option>
                                <option value="8">8</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Parity</label>
                            <select
                                value={state.consoleParity}
                                onChange={handleConsoleParityChange}
                                className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            >
                                <option value="none">None</option>
                                <option value="even">Even</option>
                                <option value="odd">Odd</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Stop Bits</label>
                            <select
                                value={state.consoleStopBits}
                                onChange={handleConsoleStopBitsChange}
                                className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            >
                                <option value="1">1</option>
                                <option value="2">2</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-muted/30 border border-border/30 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm">
                            <span className="font-medium text-foreground">Configuration:</span>
                            <span className="font-mono bg-background px-2 py-1 rounded border text-primary">
                                {state.consoleDataBits}
                                {state.consoleParity === "none" ? "N" : state.consoleParity.charAt(0).toUpperCase()}
                                {state.consoleStopBits}
                            </span>
                            {state.consoleDataBits === 8 &&
                                state.consoleParity === "none" &&
                                state.consoleStopBits === 1 && (
                                    <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                                        ✓ Standard
                                    </span>
                                )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Most common: 8 data bits, no parity, 1 stop bit
                        </p>
                    </div>
                </div>
            </div>

            {/* Debug Settings */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">
                    Debug Settings
                </h3>
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <input
                            type="checkbox"
                            id="debugLogging"
                            checked={state.debugLogging}
                            onChange={handleDebugLoggingChange}
                            className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2 mt-0.5"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="debugLogging"
                                className="text-sm font-medium text-foreground cursor-pointer"
                            >
                                Enable Debug Logging
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Shows detailed logs in browser console for troubleshooting connection and programming
                                issues.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Information */}
            <div className="lg:col-span-2 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-sky-800 dark:text-sky-200 mb-2">Settings Notes</h4>
                        <ul className="text-sm text-sky-700 dark:text-sky-300 space-y-1">
                            <li>• Programming settings apply when connecting in Programming Mode</li>
                            <li>• Console settings apply when starting the Serial Monitor</li>
                            <li>• Changes take effect on the next connection/restart</li>
                            <li>• If you have connection issues, try lower baudrates first</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
