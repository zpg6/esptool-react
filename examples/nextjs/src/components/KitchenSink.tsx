"use client";

import { ESPFile, useEspLoader } from "esptool-react";
import { useRef, useState } from "react";

export default function KitchenSink() {
    const { state, actions } = useEspLoader();
    const [files, setFiles] = useState<ESPFile[]>([]);
    const [activeTab, setActiveTab] = useState<"connection" | "flashing" | "console" | "settings">("connection");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File handling
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const newFiles: ESPFile[] = [];
        let filesProcessed = 0;

        Array.from(selectedFiles).forEach(file => {
            const reader = new FileReader();
            reader.onload = event => {
                if (event.target?.result) {
                    const result = event.target.result as ArrayBuffer;
                    const uint8Array = new Uint8Array(result);
                    const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

                    // Extract address from filename like: "bootloader_dio_40m.bin@0x1000"
                    let address = 0;
                    let fileName = file.name;

                    const addressMatch = fileName.match(/@(0x[0-9a-fA-F]+)$/);
                    if (addressMatch) {
                        address = parseInt(addressMatch[1], 16);
                        fileName = fileName.replace(/@0x[0-9a-fA-F]+$/, "");
                    }

                    newFiles.push({
                        data: base64,
                        address,
                        fileName,
                    });

                    filesProcessed++;
                    if (filesProcessed === selectedFiles.length) {
                        setFiles(prevFiles => [...prevFiles, ...newFiles]);
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const removeFile = (index: number) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    const updateFileAddress = (index: number, address: string) => {
        setFiles(prevFiles =>
            prevFiles.map((file, i) => (i === index ? { ...file, address: parseInt(address, 16) } : file))
        );
    };

    // Connection controls
    const handleConnect = async () => {
        await actions.connect();
    };

    const handleDisconnect = async () => {
        await actions.disconnect();
    };

    // Flash controls
    const handleFlash = async () => {
        if (!files.length) {
            alert("Please select at least one file to flash");
            return;
        }
        await actions.program(files);
    };

    const handleEraseFlash = async () => {
        await actions.eraseFlash();
    };

    // Console controls
    const handleStartConsole = async () => {
        await actions.startConsole();
    };

    const handleStopConsole = async () => {
        await actions.stopConsole();
    };

    // Device controls
    const handleResetDevice = async () => {
        await actions.resetDevice();
    };

    // Settings controls
    const handleBaudrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setBaudrate(parseInt(e.target.value));
    };

    const handleConsoleBaudrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        actions.setConsoleBaudrate(parseInt(e.target.value));
    };

    const handleDebugLoggingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setDebugLogging(e.target.checked);
    };

    const handleClearTerminal = () => {
        actions.clearTerminal();
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">ESPTool React Kitchen Sink</h1>

            <div className="flex mb-4 border-b">
                <button
                    className={`px-4 py-2 ${activeTab === "connection" ? "border-b-2 border-blue-500" : ""}`}
                    onClick={() => setActiveTab("connection")}
                >
                    Connection
                </button>
                <button
                    className={`px-4 py-2 ${activeTab === "flashing" ? "border-b-2 border-blue-500" : ""}`}
                    onClick={() => setActiveTab("flashing")}
                >
                    Flashing
                </button>
                <button
                    className={`px-4 py-2 ${activeTab === "console" ? "border-b-2 border-blue-500" : ""}`}
                    onClick={() => setActiveTab("console")}
                >
                    Console
                </button>
                <button
                    className={`px-4 py-2 ${activeTab === "settings" ? "border-b-2 border-blue-500" : ""}`}
                    onClick={() => setActiveTab("settings")}
                >
                    Settings
                </button>
            </div>

            {/* Connection Tab */}
            {activeTab === "connection" && (
                <div className="space-y-4">
                    <div className="flex space-x-4">
                        <button
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleConnect}
                            disabled={state.isConnected || state.isLoading}
                        >
                            Connect
                        </button>
                        <button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleDisconnect}
                            disabled={!state.isConnected || state.isLoading}
                        >
                            Disconnect
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded">
                            <h3 className="font-semibold">Connection Status:</h3>
                            <p>{state.isConnected ? "Connected" : "Disconnected"}</p>
                            {state.isConnected && state.chip && <p>Chip: {state.chip}</p>}
                        </div>

                        <div className="p-4 border rounded">
                            <h3 className="font-semibold">Operations:</h3>
                            <button
                                className="mt-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50"
                                onClick={handleResetDevice}
                                disabled={!state.isConnected || state.isLoading}
                            >
                                Reset Device
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Flashing Tab */}
            {activeTab === "flashing" && (
                <div className="space-y-4">
                    <div className="p-4 border rounded">
                        <h3 className="font-semibold mb-2">Upload Files:</h3>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="mb-4" />
                        <p className="text-sm text-gray-600 mb-4">
                            Pro tip: Name your files with address like bootloader.bin@0x1000 to automatically set the
                            flash address
                        </p>

                        <div className="space-y-2">
                            {files.map((file, index) => (
                                <div key={index} className="p-2 border rounded flex items-center">
                                    <div className="flex-1 mr-2">
                                        <p className="text-sm font-medium">{file.fileName}</p>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs">Address:</span>
                                            <input
                                                type="text"
                                                value={`0x${file.address.toString(16)}`}
                                                onChange={e => updateFileAddress(index, e.target.value)}
                                                className="text-xs p-1 border w-24"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex space-x-4">
                        <button
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleFlash}
                            disabled={!state.isConnected || state.isLoading || state.isFlashing || files.length === 0}
                        >
                            Flash Firmware
                        </button>
                        <button
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleEraseFlash}
                            disabled={!state.isConnected || state.isLoading || state.isErasing}
                        >
                            Erase Flash
                        </button>
                    </div>

                    {state.flashProgress && (
                        <div className="p-4 border rounded">
                            <h3 className="font-semibold mb-2">Flash Progress:</h3>
                            <p>File: {state.flashProgress.fileName}</p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full"
                                    style={{
                                        width: `${(state.flashProgress.written / state.flashProgress.total) * 100}%`,
                                    }}
                                ></div>
                            </div>
                            <p className="text-right text-sm mt-1">
                                {Math.floor((state.flashProgress.written / state.flashProgress.total) * 100)}%
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Console Tab */}
            {activeTab === "console" && (
                <div className="space-y-4">
                    <div className="flex space-x-4">
                        <button
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleStartConsole}
                            disabled={state.isConsoleConnected || state.isLoading}
                        >
                            Start Console
                        </button>
                        <button
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
                            onClick={handleStopConsole}
                            disabled={!state.isConsoleConnected || state.isLoading}
                        >
                            Stop Console
                        </button>
                        <button
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                            onClick={handleClearTerminal}
                        >
                            Clear Terminal
                        </button>
                    </div>

                    <div className="border rounded p-2 h-96 overflow-auto bg-black">
                        <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                            {state.terminalOutput.join("\n")}
                        </pre>
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded">
                            <h3 className="font-semibold mb-2">Programming Settings:</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium">Baudrate:</label>
                                    <select
                                        value={state.baudrate}
                                        onChange={handleBaudrateChange}
                                        className="mt-1 block w-full p-2 border rounded"
                                    >
                                        <option value="115200">115200</option>
                                        <option value="230400">230400</option>
                                        <option value="460800">460800</option>
                                        <option value="921600">921600</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border rounded">
                            <h3 className="font-semibold mb-2">Console Settings:</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium">Console Baudrate:</label>
                                    <select
                                        value={state.consoleBaudrate}
                                        onChange={handleConsoleBaudrateChange}
                                        className="mt-1 block w-full p-2 border rounded"
                                    >
                                        <option value="9600">9600</option>
                                        <option value="57600">57600</option>
                                        <option value="74880">74880 (ESP Boot Debug)</option>
                                        <option value="115200">115200</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border rounded">
                        <h3 className="font-semibold mb-2">Debug Settings:</h3>
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="debugLogging"
                                    checked={state.debugLogging}
                                    onChange={handleDebugLoggingChange}
                                    className="mr-2"
                                />
                                <label htmlFor="debugLogging">Enable Debug Logging</label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status and Errors */}
            <div className="mt-6">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <div
                            className={`h-3 w-3 rounded-full mr-2 ${
                                state.isConnected ? "bg-green-500" : "bg-gray-400"
                            }`}
                        ></div>
                        <span className="text-sm">Connection</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className={`h-3 w-3 rounded-full mr-2 ${
                                state.isConsoleConnected ? "bg-green-500" : "bg-gray-400"
                            }`}
                        ></div>
                        <span className="text-sm">Console</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className={`h-3 w-3 rounded-full mr-2 ${
                                state.isLoading ? "bg-yellow-500 animate-pulse" : "bg-gray-400"
                            }`}
                        ></div>
                        <span className="text-sm">Loading</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className={`h-3 w-3 rounded-full mr-2 ${
                                state.isFlashing ? "bg-blue-500 animate-pulse" : "bg-gray-400"
                            }`}
                        ></div>
                        <span className="text-sm">Flashing</span>
                    </div>
                </div>

                {state.error && (
                    <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                        {state.error.toString()}
                    </div>
                )}
            </div>
        </div>
    );
}
