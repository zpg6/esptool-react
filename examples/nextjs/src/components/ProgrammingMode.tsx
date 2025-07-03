"use client";

import { ESPFile, useEspLoader } from "esptool-react";
import React, { useMemo, useRef, useState } from "react";
import type { FirmwareFileType } from "../../../../src/types";
import {
    detectFileType,
    generatePreset,
    getChipRequirements,
    validateFile,
    validateFirmwareSet,
} from "../../../../src/utils/firmwareGuidance";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip } from "./ui/tooltip";
import { ChevronUp, ChevronDown, AlignJustify, Upload, Zap, Trash2 } from "lucide-react";

export const ProgrammingMode: React.FC = () => {
    const { state, actions } = useEspLoader();
    const [files, setFiles] = useState<ESPFile[]>([]);
    const [programmingLog, setProgrammingLog] = useState<
        { time: string; message: string; type: "info" | "error" | "success" }[]
    >([]);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [isAtTop, setIsAtTop] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);

    // Validate files when they change or chip is detected
    const validationSummary = useMemo(() => {
        return validateFirmwareSet(files, state.chip);
    }, [files, state.chip]);

    const chipRequirements = useMemo(() => {
        return getChipRequirements(state.chip);
    }, [state.chip]);

    // Track flash progress and log updates (throttled to avoid spam)
    const lastProgressRef = useRef<number>(-1);
    React.useEffect(() => {
        if (state.flashProgress) {
            const progress = Math.floor((state.flashProgress.written / state.flashProgress.total) * 100);
            // Only log every 10% to avoid spam
            if (progress % 10 === 0 && progress !== lastProgressRef.current) {
                lastProgressRef.current = progress;
                addLogMessage(`Flashing ${state.flashProgress.fileName}: ${progress}%`, "info");
            }
        }
    }, [state.flashProgress]);

    // Scroll to bottom function
    const scrollToBottom = React.useCallback((smooth = true) => {
        if (logRef.current) {
            logRef.current.scrollTo({
                top: logRef.current.scrollHeight,
                behavior: smooth ? "smooth" : "instant",
            });
        }
    }, []);

    // Scroll to top function
    const scrollToTop = React.useCallback(() => {
        if (logRef.current) {
            logRef.current.scrollTo({
                top: 0,
                behavior: "instant",
            });
        }
    }, []);

    // Auto-scroll when new content arrives
    React.useEffect(() => {
        if (autoScrollEnabled && programmingLog.length > 0) {
            requestAnimationFrame(() => {
                scrollToBottom(false);
            });
        }
    }, [programmingLog, autoScrollEnabled, scrollToBottom]);

    // Intersection Observer for reliable scroll detection
    React.useEffect(() => {
        if (!logRef.current || !topSentinelRef.current || !bottomSentinelRef.current) return;

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
                root: logRef.current,
                rootMargin: "0px",
                threshold: 0.1,
            }
        );

        observer.observe(topSentinelRef.current);
        observer.observe(bottomSentinelRef.current);

        return () => observer.disconnect();
    }, [programmingLog]);

    const toggleAutoScroll = React.useCallback(() => {
        setAutoScrollEnabled(prev => {
            const newValue = !prev;
            if (newValue) {
                requestAnimationFrame(() => scrollToBottom(false));
            }
            return newValue;
        });
    }, [scrollToBottom]);

    // Add message to programming log
    const addLogMessage = (message: string, type: "info" | "error" | "success" = "info") => {
        const timestamp = new Date().toLocaleTimeString();
        setProgrammingLog(prev => [...prev, { time: timestamp, message, type }]);
    };

    const clearLog = () => {
        setProgrammingLog([]);
    };

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
                    } else {
                        // Auto-suggest address based on detected file type
                        const detectedType = detectFileType(fileName, 0);
                        if (state.chip && chipRequirements && detectedType !== "unknown") {
                            const fileInfo = chipRequirements.requiredFiles[detectedType];
                            if (fileInfo?.recommendedAddress) {
                                address = fileInfo.recommendedAddress;
                            }
                        }
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

    // Preset handling
    const loadPreset = (presetType: "basic" | "ota") => {
        if (!state.chip) {
            alert("Please connect to a device first to load chip-specific presets");
            return;
        }

        const preset = generatePreset(state.chip, presetType);
        const presetFiles: ESPFile[] = preset.map(
            (item: { type: FirmwareFileType; address: number; description: string }) => ({
                data: "", // Will be filled when user uploads actual files
                address: item.address,
                fileName: `${item.type}.bin`,
            })
        );

        setFiles(presetFiles);
    };

    // Connection controls
    const handleConnect = async () => {
        addLogMessage("Attempting to connect to ESP device...", "info");
        try {
            const result = await actions.connect();
            if (result) {
                addLogMessage(`Successfully connected to ${result}`, "success");
            } else {
                addLogMessage("Connection failed", "error");
            }
        } catch (error: any) {
            addLogMessage(`Connection error: ${error.message}`, "error");
        }
    };

    const handleDisconnect = async () => {
        addLogMessage("Disconnecting from ESP device...", "info");
        try {
            await actions.disconnect();
            addLogMessage("Device disconnected successfully", "success");
        } catch (error: any) {
            addLogMessage(`Disconnect error: ${error.message}`, "error");
        }
    };

    // Flash controls
    const handleFlash = async () => {
        if (!files.length) {
            addLogMessage("Please select at least one file to flash", "error");
            return;
        }

        if (!validationSummary.isComplete) {
            const issues = [
                ...validationSummary.missingRequired.map((type: FirmwareFileType) => `Missing ${type}`),
                ...validationSummary.addressConflicts.map(
                    (conflict: { file1: string; file2: string; address: number }) =>
                        `Address conflict at 0x${conflict.address.toString(16)}: ${conflict.file1} and ${conflict.file2}`
                ),
            ];

            addLogMessage(`Validation warnings found: ${issues.join(", ")}`, "error");
            const proceed = confirm(`Validation warnings found:\n${issues.join("\n")}\n\nContinue anyway?`);

            if (!proceed) {
                addLogMessage("Programming cancelled by user", "info");
                return;
            }
        }

        addLogMessage(`Starting to program ${files.length} file(s)...`, "info");
        try {
            await actions.program(files);
            addLogMessage("Programming completed successfully", "success");
        } catch (error: any) {
            addLogMessage(`Programming failed: ${error.message}`, "error");
        }
    };

    const handleEraseFlash = async () => {
        addLogMessage("Starting flash erase operation...", "info");
        try {
            await actions.eraseFlash();
            addLogMessage("Flash erased successfully", "success");
        } catch (error: any) {
            addLogMessage(`Flash erase failed: ${error.message}`, "error");
        }
    };

    // Device controls
    const handleResetDevice = async () => {
        addLogMessage("Resetting ESP device...", "info");
        try {
            await actions.resetDevice();
            addLogMessage("Device reset successfully", "success");
        } catch (error: any) {
            addLogMessage(`Device reset failed: ${error.message}`, "error");
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Connection Section */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div
                            className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                state.isConnected
                                    ? "bg-emerald-500 shadow-emerald-500/50 shadow-lg"
                                    : "bg-gray-300 dark:bg-gray-600"
                            }`}
                        />
                        <div>
                            <h3 className="text-lg font-semibold">
                                {state.isConnected ? "Device Connected" : "Connect to ESP Device"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {state.isConnected
                                    ? `Ready to program${state.chip ? ` • ${state.chip}` : ""}`
                                    : "Connect your ESP device via USB to begin programming"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {state.isConnected ? (
                            <>
                                <Button
                                    onClick={handleResetDevice}
                                    variant="outline"
                                    size="sm"
                                    disabled={state.isLoading}
                                    className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/20"
                                >
                                    Reset Device
                                </Button>
                                <Button
                                    onClick={handleDisconnect}
                                    variant="outline"
                                    size="sm"
                                    disabled={state.isLoading}
                                >
                                    Disconnect
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={handleConnect}
                                disabled={state.isLoading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {state.isLoading ? "Connecting..." : "Connect"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Chip-specific Requirements */}
            {state.isConnected && chipRequirements && (
                <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">{state.chip} Requirements</h3>
                            <p className="text-sm text-muted-foreground">
                                Required firmware files for your {state.chip} device
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(chipRequirements.requiredFiles).map(([type, info]) => {
                                const fileInfo = info as any; // Type assertion for the mapped value
                                return (
                                    <div
                                        key={type}
                                        className={`p-4 rounded-lg border ${
                                            fileInfo.isRequired
                                                ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20"
                                                : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium capitalize">{type.replace("_", " ")}</h4>
                                            <span
                                                className={`text-xs px-2 py-1 rounded ${
                                                    fileInfo.isRequired
                                                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                                                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                                }`}
                                            >
                                                {fileInfo.isRequired ? "Required" : "Optional"}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">{fileInfo.description}</p>
                                        {fileInfo.recommendedAddress && (
                                            <p className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                Address: 0x{fileInfo.recommendedAddress.toString(16)}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={() => loadPreset("basic")}
                                variant="outline"
                                size="sm"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/20"
                            >
                                Load Basic Template
                            </Button>
                            <Button
                                onClick={() => loadPreset("ota")}
                                variant="outline"
                                size="sm"
                                className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/20"
                            >
                                Load OTA Template
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Summary */}
            {files.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Firmware Validation</h3>
                            <div
                                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                                    validationSummary.isComplete
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                }`}
                            >
                                <div
                                    className={`w-2 h-2 rounded-full ${
                                        validationSummary.isComplete ? "bg-emerald-500" : "bg-amber-500"
                                    }`}
                                />
                                <span>{validationSummary.isComplete ? "Ready to Flash" : "Issues Found"}</span>
                            </div>
                        </div>

                        {validationSummary.missingRequired.length > 0 && (
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
                                    Missing Required Files:
                                </h4>
                                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                    {validationSummary.missingRequired.map(type => (
                                        <li key={type}>• {type.replace("_", " ")}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {validationSummary.addressConflicts.length > 0 && (
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Address Conflicts:</h4>
                                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                    {validationSummary.addressConflicts.map((conflict, i) => (
                                        <li key={i}>
                                            • 0x{conflict.address.toString(16)}: {conflict.file1} and {conflict.file2}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {validationSummary.suggestions.length > 0 && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Suggestions:</h4>
                                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                                    {validationSummary.suggestions.map((suggestion, i) => (
                                        <li key={i}>• {suggestion}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* File Upload Section */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Firmware Files</h3>
                        <p className="text-sm text-muted-foreground">
                            Upload .bin files to flash to your ESP device
                            {state.chip && (
                                <span className="block mt-1">
                                    For {state.chip}: bootloader (0x
                                    {chipRequirements?.bootloaderAddress.toString(16) || "?"}), partition table
                                    (0x8000), app (0x10000)
                                </span>
                            )}
                        </p>
                    </div>

                    <div
                        className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-primary/50 transition-colors duration-200 cursor-pointer bg-muted/20"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            accept=".bin"
                            className="hidden"
                        />
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-base font-medium text-foreground mb-1">
                            {files.length > 0 ? "Add more files" : "Choose firmware files"}
                        </p>
                        <p className="text-sm text-muted-foreground">Click to browse or drag and drop .bin files</p>
                    </div>

                    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        💡 <strong>Tip:</strong> Name files with addresses like{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">bootloader.bin@0x1000</code> to
                        auto-set flash addresses
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium">Files to Flash ({files.length})</h4>
                                <Button
                                    onClick={() => setFiles([])}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Clear All
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {files.map((file, index) => {
                                    const validation = validateFile(file, state.chip);
                                    const detectedType = detectFileType(file.fileName || "", file.address);

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 border rounded-lg space-y-3 ${
                                                validation.isValid
                                                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                                                    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2">
                                                            <p className="text-sm font-medium text-foreground truncate">
                                                                {file.fileName || `file_${index}`}
                                                            </p>
                                                            <span
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                    detectedType === "unknown"
                                                                        ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                                                        : detectedType === "bootloader"
                                                                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                                                                          : detectedType === "partition_table"
                                                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                                                            : detectedType === "app"
                                                                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                                                              : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                                                                }`}
                                                            >
                                                                {detectedType.replace("_", " ")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => removeFile(index)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/30"
                                                >
                                                    Remove
                                                </Button>
                                            </div>

                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center space-x-2">
                                                    <label className="text-sm font-medium text-muted-foreground">
                                                        Address:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={`0x${file.address.toString(16)}`}
                                                        onChange={e => updateFileAddress(index, e.target.value)}
                                                        className="w-24 px-2 py-1 text-sm border border-border rounded font-mono bg-background"
                                                        placeholder="0x0000"
                                                    />
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Size:{" "}
                                                    {file.data
                                                        ? `${Math.round(atob(file.data).length / 1024)}KB`
                                                        : "Unknown"}
                                                </div>
                                            </div>

                                            {/* Validation messages */}
                                            {validation.errors.length > 0 && (
                                                <div className="text-sm text-red-600 dark:text-red-400">
                                                    {validation.errors.map((error, i) => (
                                                        <div key={i}>⚠️ {error}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {validation.warnings.length > 0 && (
                                                <div className="text-sm text-amber-600 dark:text-amber-400">
                                                    {validation.warnings.map((warning, i) => (
                                                        <div key={i}>⚠️ {warning}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {validation.suggestions.length > 0 && (
                                                <div className="text-sm text-blue-600 dark:text-blue-400">
                                                    {validation.suggestions.map((suggestion, i) => (
                                                        <div key={i}>💡 {suggestion}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Flash Operations */}
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Flash Operations</h3>
                        <p className="text-sm text-muted-foreground">Program your device or erase its flash memory</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={handleFlash}
                            disabled={!state.isConnected || state.isLoading || state.isFlashing || files.length === 0}
                            size="lg"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2 font-medium"
                        >
                            {state.isFlashing && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            <Zap className="w-5 h-5" />
                            <span>Flash Firmware</span>
                        </Button>

                        <Button
                            onClick={handleEraseFlash}
                            disabled={!state.isConnected || state.isLoading || state.isErasing}
                            variant="destructive"
                            size="lg"
                            className="flex items-center space-x-2 font-medium"
                        >
                            {state.isErasing && (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                            <Trash2 className="w-5 h-5" />
                            <span>Erase Flash</span>
                        </Button>
                    </div>

                    {!state.isConnected && (
                        <div className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                            ⚠️ Device must be connected to perform flash operations
                        </div>
                    )}
                </div>
            </div>

            {/* Progress */}
            {state.flashProgress && (
                <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Flashing Progress</h3>
                            <span className="text-2xl font-bold text-primary">
                                {Math.floor((state.flashProgress.written / state.flashProgress.total) * 100)}%
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{state.flashProgress.fileName}</span>
                                <span className="text-sm text-muted-foreground">
                                    {state.flashProgress.written} / {state.flashProgress.total} bytes
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300 ease-out rounded-full shadow-sm"
                                    style={{
                                        width: `${(state.flashProgress.written / state.flashProgress.total) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Programming Log Console */}
            <div className="bg-card border border-border rounded-lg shadow-sm h-[400px] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div>
                            <h3 className="text-lg font-semibold">Programming Console</h3>
                            <p className="text-xs text-muted-foreground">Real-time programming output</p>
                        </div>

                        <div className="flex items-center space-x-2">
                            {(state.isFlashing || state.isErasing) && (
                                <Badge variant="default" className="flex items-center space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span className="text-xs font-medium">
                                        {state.isFlashing ? "Programming" : "Erasing"}
                                    </span>
                                </Badge>
                            )}

                            {state.isConnected && (
                                <Badge variant="outline" className="text-xs">
                                    {state.chip || "ESP Device"}
                                </Badge>
                            )}

                            {programmingLog.length > 0 && (
                                <Badge
                                    variant="outline"
                                    className="text-xs bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800"
                                >
                                    {programmingLog.length} entries
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        <Tooltip content="Clear log" side="bottom">
                            <Button
                                onClick={clearLog}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={programmingLog.length === 0}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Log Area */}
                <div className="flex-1 bg-muted/20 relative min-h-0">
                    <div ref={logRef} className="absolute inset-0 overflow-y-auto p-4 font-mono text-sm">
                        {programmingLog.length === 0 ? (
                            <>
                                <div ref={topSentinelRef} className="h-0 w-full" />
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <p className="font-mono text-sm">Programming output will appear here...</p>
                                </div>
                                <div ref={bottomSentinelRef} className="h-0 w-full" />
                            </>
                        ) : (
                            <>
                                <div ref={topSentinelRef} className="h-0 w-full" />
                                <div className="space-y-1">
                                    {programmingLog.map((entry, index) => (
                                        <div key={index} className="leading-relaxed text-foreground">
                                            <span className="text-muted-foreground whitespace-nowrap">
                                                [{entry.time}]
                                            </span>
                                            <span className="mx-2">
                                                {entry.type === "error" && "❌"}
                                                {entry.type === "success" && "✅"}
                                                {entry.type === "info" && "ℹ️"}
                                            </span>
                                            <span
                                                className={`whitespace-pre-wrap ${
                                                    entry.type === "error"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : entry.type === "success"
                                                          ? "text-green-600 dark:text-green-400"
                                                          : "text-foreground"
                                                }`}
                                            >
                                                {entry.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div ref={bottomSentinelRef} className="h-0 w-full" />
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border flex items-center justify-between text-sm text-muted-foreground flex-shrink-0">
                    <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                            <AlignJustify className="w-4 h-4" />
                            <span>Lines: {programmingLog.length}</span>
                        </span>

                        <span className="flex items-center space-x-1 text-muted-foreground/75">
                            <span>115200 baud</span>
                        </span>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={toggleAutoScroll}
                            className="flex items-center space-x-1 hover:text-foreground transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${autoScrollEnabled ? "bg-blue-500" : "bg-muted-foreground"}`}
                            ></span>
                            <span>Auto-scroll {autoScrollEnabled ? "ON" : "OFF"}</span>
                        </button>

                        <div className="flex items-center space-x-1 ml-2 pl-2 border-l border-border">
                            <button
                                onClick={scrollToTop}
                                disabled={isAtTop || programmingLog.length === 0}
                                className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => scrollToBottom(false)}
                                disabled={isAtBottom || programmingLog.length === 0}
                                className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
