import { ESPLoader, Transport as ESPLoaderTransport, FlashOptions, LoaderOptions } from "esptool-js";
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ESPFile, ESPLoaderActions, FlashProgress, Transport } from "../types";
import { ESPLoaderContext } from "./ESPLoaderContext";
import { esploaderReducer, initialESPLoaderState } from "./esploaderReducer";

// Logger utility for consistent logging
const createLogger = (debugLogging: boolean) => {
    return {
        debug: (message: string, ...args: any[]) => {
            if (debugLogging) {
                console.debug(`[ESPLoader] ${message}`, ...args);
            }
        },
        info: (message: string, ...args: any[]) => {
            console.info(`[ESPLoader] ${message}`, ...args);
        },
        warn: (message: string, ...args: any[]) => {
            console.warn(`[ESPLoader] ${message}`, ...args);
        },
        error: (message: string, ...args: any[]) => {
            console.error(`[ESPLoader] ${message}`, ...args);
        },
        // Helper method to log and interpret serial data
        logSerialData: (data: Uint8Array | null, context: string) => {
            if (!debugLogging || !data) return;

            // Only log if debug is enabled
            const hexView = new Array(Math.min(data.length, 32))
                .fill(0)
                .map((_, i) => data[i].toString(16).padStart(2, "0"))
                .join(" ");

            // Try to interpret as ASCII if reasonable
            let asciiView = "";
            try {
                // Only show ASCII for printable characters
                asciiView = new Array(Math.min(data.length, 32))
                    .fill(0)
                    .map((_, i) => {
                        const char = data[i];
                        return char >= 32 && char <= 126 ? String.fromCharCode(char) : ".";
                    })
                    .join("");
            } catch (e) {
                asciiView = "[non-printable]";
            }

            console.debug(`[ESPLoader Serial] ${context}: ${data.length} bytes`);
            console.debug(`[ESPLoader Serial] Hex: ${hexView}${data.length > 32 ? "..." : ""}`);
            console.debug(`[ESPLoader Serial] ASCII: ${asciiView}${data.length > 32 ? "..." : ""}`);
        },
    };
};

// Global types for Serial API are in src/types.ts

// Helper to get navigator.serial or a polyfill
async function getSerialInstance(): Promise<Serial> {
    // Serial type comes from global types
    if ((navigator as any).serial) {
        return (navigator as any).serial;
    }
    // Import the polyfill for its side-effects, then check navigator.serial again.
    await import("web-serial-polyfill");
    if ((navigator as any).serial) {
        return (navigator as any).serial;
    }
    throw new Error("Web Serial API not available and polyfill failed to initialize.");
}

interface ESPLoaderProviderProps {
    children: React.ReactNode;
    initialBaudrate?: number;
    initialConsoleBaudrate?: number;
    initialDebugLogging?: boolean;
    initialRomBaudrate?: number; // Optional prop for ROM baudrate
    calculateMD5Hash: (image: Uint8Array) => string;
}

export const ESPLoaderProvider: React.FC<ESPLoaderProviderProps> = ({
    children,
    initialBaudrate,
    initialConsoleBaudrate,
    initialDebugLogging,
    initialRomBaudrate, // Use this prop
    calculateMD5Hash,
}) => {
    const [state, dispatch] = useReducer(esploaderReducer, {
        ...initialESPLoaderState,
        baudrate: initialBaudrate ?? 115200, // Conservative default for better compatibility
        consoleBaudrate: initialConsoleBaudrate ?? initialESPLoaderState.consoleBaudrate,
        debugLogging: initialDebugLogging ?? initialESPLoaderState.debugLogging,
        // romBaudrate could be part of state if dynamic changes are needed, or taken from prop
    });

    // Create logger that updates when debugLogging changes
    const logger = useMemo(() => createLogger(state.debugLogging), [state.debugLogging]);

    // Store romBaudrate, defaulting to programming baudrate if not provided
    const romBaudrate = useMemo(() => initialRomBaudrate ?? state.baudrate, [initialRomBaudrate, state.baudrate]);

    // Program mode resources
    const programDevice = useRef<SerialPort | null>(null);
    const programTransport = useRef<ESPLoaderTransport | null>(null);
    const esploaderInstance = useRef<ESPLoader | null>(null);

    // Console mode resources
    const consoleDevice = useRef<SerialPort | null>(null);
    const consoleTransport = useRef<ESPLoaderTransport | null>(null);
    const consoleReader = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
    const keepConsoleReading = useRef<boolean>(false);
    const consoleReadingInProgress = useRef<boolean>(false);

    // Helper to reset ESP device into bootloader mode
    const resetToBootloader = useCallback(
        async (port: SerialPort): Promise<void> => {
            logger.debug("Attempting to reset device into bootloader mode");
            let didOpenPort = false;

            try {
                // Make sure the port is open before we try to set signals
                if (!port.readable) {
                    logger.debug("Opening port before bootloader reset sequence");
                    // Use a safe lower baudrate for initial connection
                    await port.open({ baudRate: 115200 });
                    didOpenPort = true;
                }

                // Create a temporary transport just for reset sequence
                const tempTransport = new ESPLoaderTransport(port, state.debugLogging);

                // Standard ESP bootloader sequence:
                // 1. Set DTR true, RTS true
                // 2. Set DTR false, RTS true (pulls GPIO0 low, keeps reset active)
                // 3. Set DTR false, RTS false (releases reset)
                // 4. Wait for device to enter bootloader

                logger.debug("Bootloader sequence: Step 1");
                await tempTransport.setDTR(true);
                await tempTransport.setRTS(true);
                await new Promise(resolve => setTimeout(resolve, 100));

                logger.debug("Bootloader sequence: Step 2");
                await tempTransport.setDTR(false);
                await new Promise(resolve => setTimeout(resolve, 100));

                logger.debug("Bootloader sequence: Step 3");
                await tempTransport.setRTS(false);

                // Wait for bootloader to start
                logger.debug("Waiting for bootloader to initialize");
                await new Promise(resolve => setTimeout(resolve, 750)); // Give it more time

                // Don't disconnect the transport as it might close buffers we need
                // Just leave it for garbage collection

                logger.debug("Reset to bootloader sequence completed");
            } catch (e: any) {
                logger.warn(`Failed to reset to bootloader: ${e.message}`, e);
                // Continue anyway, might still work
            }
        },
        [state.debugLogging, logger]
    );

    const esploaderTerminal = useMemo(
        () => ({
            clean() {
                dispatch({ type: "CLEAR_TERMINAL_OUTPUT" });
            },
            writeLine(data: string) {
                dispatch({ type: "ADD_TERMINAL_OUTPUT", payload: data });
            },
            write(data: string) {
                // Use a new action type that handles appending to last line without needing state dependency
                dispatch({ type: "APPEND_TERMINAL_OUTPUT", payload: data });
            },
        }),
        [] // Remove state.terminalOutput dependency to prevent unnecessary re-renders
    );

    // Define stopConsole before it's used in connect
    const stopConsole = useCallback(async () => {
        logger.info("Stopping console mode");
        keepConsoleReading.current = false;
        consoleReadingInProgress.current = false; // Stop race condition protection

        if (consoleReader.current) {
            try {
                logger.debug("Cancelling console reader");
                await consoleReader.current.cancel();
            } catch (e: any) {
                logger.warn(`Error cancelling console reader: ${e.message}`, e);
            }
            consoleReader.current = null;
        }
        if (consoleTransport.current) {
            try {
                logger.debug("Disconnecting console transport");
                await consoleTransport.current.disconnect();
            } catch (e) {
                logger.debug("Error disconnecting console transport", e);
                /*ignore*/
            }
        }
        consoleTransport.current = null;

        if (consoleDevice.current && consoleDevice.current.readable) {
            try {
                logger.debug("Closing console device port");
                await consoleDevice.current.close();
            } catch (e) {
                logger.debug("Error closing console device port", e);
                /*ignore*/
            }
        }
        consoleDevice.current = null;
        dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: false });
        logger.info("Console mode stopped successfully");
    }, [esploaderTerminal, logger]);

    // Connect function specific for Programming mode
    const connect = useCallback(
        async (portToUse?: SerialPort) => {
            logger.info("Attempting to connect to ESP device in Program mode");
            dispatch({ type: "SET_IS_LOADING", payload: true });
            dispatch({ type: "SET_ERROR", payload: null });

            // If console is connected, disconnect it first
            if (state.isConsoleConnected) {
                logger.info("Console mode active - stopping console before program mode");
                await stopConsole();
            }

            try {
                logger.debug("Getting serial instance for program mode");
                const serialControl = await getSerialInstance();
                const selectedPort = portToUse ?? (await serialControl.requestPort());
                if (!selectedPort) {
                    const errorMsg = "No port selected";
                    logger.error(errorMsg);
                    dispatch({ type: "SET_ERROR", payload: errorMsg });
                    dispatch({ type: "SET_IS_LOADING", payload: false });
                    return "";
                }
                logger.debug("Port selected", selectedPort);
                programDevice.current = selectedPort;

                // Important: Do NOT open the port here - let ESPLoader handle it completely
                // ESPLoader will open the port internally via transport.connect()
                logger.debug(`Creating program transport with baudrate ${state.baudrate}`);
                const transport = new ESPLoaderTransport(selectedPort, state.debugLogging);
                programTransport.current = transport;

                const loaderOpts: LoaderOptions = {
                    transport,
                    baudrate: state.baudrate,
                    romBaudrate: romBaudrate,
                    terminal: esploaderTerminal,
                };
                logger.debug("Creating ESPLoader instance with options:", {
                    baudrate: loaderOpts.baudrate,
                    romBaudrate: loaderOpts.romBaudrate,
                });
                const loader = new ESPLoader(loaderOpts);
                esploaderInstance.current = loader;

                logger.debug("Initializing main loader");

                // Add retry logic for connection
                const maxRetries = 3;
                let lastError: Error | null = null;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        logger.debug(`Connection attempt ${attempt} of ${maxRetries}`);
                        if (attempt > 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Increasing delay
                        }

                        await loader.main();
                        break; // Success, exit retry loop
                    } catch (connectError: any) {
                        lastError = connectError;
                        logger.warn(`Connection attempt ${attempt} failed: ${connectError.message}`);

                        if (attempt === maxRetries) {
                            throw connectError; // Final attempt failed, throw error
                        }

                        // For certain errors, don't retry
                        const errorMsg = connectError.message?.toLowerCase() || "";
                        if (errorMsg.includes("permission") || errorMsg.includes("access denied")) {
                            throw connectError; // Don't retry permission errors
                        }

                        // For device communication errors, add longer delay between retries
                        // to give ESP32 more time to reset and enter bootloader mode
                        if (
                            errorMsg.includes("timeout") ||
                            errorMsg.includes("sync") ||
                            errorMsg.includes("invalid data")
                        ) {
                            logger.debug(`Device communication error, adding extra delay before retry ${attempt + 1}`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Extra 2 second delay
                        }
                    }
                }

                try {
                    // This block is for successful connection - keeping original error handling
                    await Promise.resolve(); // Placeholder to maintain structure
                } catch (connectError: any) {
                    // Handle specific connection errors with user-friendly messages
                    const errorMsg = connectError.message?.toLowerCase() || "";
                    logger.error("Connection error occurred", connectError);

                    if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
                        throw new Error(
                            "Connection timeout after retries. Try these steps:\n" +
                                "1. Hold the BOOT button while connecting\n" +
                                "2. Press and release RESET, then BOOT\n" +
                                "3. Check your USB cable and try a different port\n" +
                                "4. Try a lower baudrate (115200)"
                        );
                    } else if (
                        errorMsg.includes("invalid data") ||
                        errorMsg.includes("sync failed") ||
                        errorMsg.includes("read timeout")
                    ) {
                        throw new Error(
                            "Device communication failed after retries. This usually means the device is not in bootloader mode.\n\n" +
                                "Try these steps:\n" +
                                "1. Put device in bootloader mode:\n" +
                                "   • Hold BOOT button, press RESET, release RESET, release BOOT\n" +
                                "   • OR hold BOOT button while plugging in USB\n" +
                                "2. Try a much lower baudrate (115200)\n" +
                                "3. Check that you have the right USB drivers\n" +
                                "4. Make sure no other programs are using the port\n" +
                                "5. Try a different USB cable/port"
                        );
                    } else if (errorMsg.includes("access denied") || errorMsg.includes("permission")) {
                        throw new Error(
                            "Permission denied. Try these steps:\n" +
                                "1. Close other programs using the serial port\n" +
                                "2. Disconnect and reconnect the device\n" +
                                "3. Try running as administrator (Windows)\n" +
                                "4. Check device permissions (Linux/Mac)"
                        );
                    } else if (errorMsg.includes("device not found") || errorMsg.includes("no device")) {
                        throw new Error(
                            "Device not found. Try these steps:\n" +
                                "1. Check USB connection\n" +
                                "2. Install proper USB drivers\n" +
                                "3. Try a different USB port/cable\n" +
                                "4. Verify device is powered on"
                        );
                    } else if (errorMsg.includes("busy") || errorMsg.includes("in use")) {
                        throw new Error(
                            "Device is busy or in use. Try these steps:\n" +
                                "1. Close other serial monitor programs\n" +
                                "2. Disconnect from console mode first\n" +
                                "3. Reset the device\n" +
                                "4. Wait a moment and try again"
                        );
                    }

                    // Generic error with helpful context
                    throw new Error(
                        `Connection failed after ${maxRetries} attempts: ${connectError.message}\n\n` +
                            "General troubleshooting:\n" +
                            "1. Put ESP device in bootloader mode:\n" +
                            "   • Hold BOOT button, press RESET, release RESET, release BOOT\n" +
                            "   • OR hold BOOT while connecting USB\n" +
                            "2. Try a lower baudrate (115200 instead of 921600)\n" +
                            "3. Check USB cable and drivers\n" +
                            "4. Close other programs using the serial port\n" +
                            "5. Try a different USB port"
                    );
                }

                logger.info(`Successfully connected to ESP device in Program mode: ${loader.chip.CHIP_NAME}`);
                dispatch({ type: "SET_ESPLOADER", payload: loader });
                dispatch({
                    type: "SET_TRANSPORT",
                    payload: transport as unknown as Transport,
                });
                dispatch({ type: "SET_IS_CONNECTED", payload: true });
                dispatch({ type: "SET_CHIP", payload: loader.chip.CHIP_NAME });
                return loader.chip.CHIP_NAME;
            } catch (e: any) {
                const errorMessage = e.message || "Failed to connect";
                logger.error(`Connection error: ${errorMessage}`, e);

                // Provide more user-friendly messages for common errors
                let userMessage = errorMessage;
                if (errorMessage.includes("timeout")) {
                    userMessage = "Connection timeout. Try pressing the BOOT button on your device while connecting.";
                } else if (errorMessage.includes("NetworkError") || errorMessage.includes("Failed to execute 'open'")) {
                    userMessage = "USB connection error. Try disconnecting and reconnecting your device.";
                } else if (errorMessage.includes("invalid data") || errorMessage.includes("Invalid data")) {
                    userMessage = "Received invalid data. Try a different baudrate or check your USB connection.";
                }

                dispatch({ type: "SET_ERROR", payload: userMessage });
                dispatch({ type: "SET_IS_CONNECTED", payload: false });

                // Clean up properly after connection error
                if (programTransport.current) {
                    logger.debug("Disconnecting transport after error");
                    try {
                        await programTransport.current.disconnect();
                    } catch (e) {
                        logger.debug("Error disconnecting transport during cleanup", e);
                    }
                }
                programTransport.current = null;

                // Also close the port to release any locks so ESPLoader can open it cleanly next time
                if (programDevice.current) {
                    logger.debug("Closing device port after connection error");
                    try {
                        // Only close if it's actually open
                        if (programDevice.current.readable) {
                            await programDevice.current.close();
                        }
                        // Give device time to reset after error
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (e) {
                        logger.debug("Error closing device port during cleanup", e);
                    }
                }
                programDevice.current = null;
                esploaderInstance.current = null;

                return "";
            } finally {
                dispatch({ type: "SET_IS_LOADING", payload: false });
            }
        },
        [
            state.baudrate,
            state.debugLogging,
            state.isConsoleConnected,
            stopConsole,
            esploaderTerminal,
            romBaudrate,
            logger,
        ]
    );

    const disconnect = useCallback(async () => {
        logger.info("Disconnecting from ESP device in Program mode");
        dispatch({ type: "SET_IS_LOADING", payload: true });
        try {
            if (programTransport.current) {
                logger.debug("Disconnecting program transport");
                await programTransport.current.disconnect();
            }

            // Ensure the port is fully closed to release any locks
            // This is important so ESPLoader can open it cleanly on next connection
            if (programDevice.current) {
                logger.debug("Closing program device port to release locks");
                try {
                    // Only close if it's actually open
                    if (programDevice.current.readable) {
                        await programDevice.current.close();
                    }
                } catch (e) {
                    logger.debug("Error closing program device port", e);
                }

                // Give the ESP32 device time to fully reset and enter bootloader mode
                logger.debug("Waiting for ESP32 to reset after disconnect");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            logger.info("Successfully disconnected from program mode");
            dispatch({ type: "RESET_STATE" });
            programDevice.current = null;
            programTransport.current = null;
            esploaderInstance.current = null;
        } catch (e: any) {
            const errorMessage = e.message || "Failed to disconnect";
            logger.error(`Disconnect error: ${errorMessage}`, e);
            dispatch({ type: "SET_ERROR", payload: errorMessage });
        } finally {
            dispatch({ type: "SET_IS_CONNECTED", payload: false });
            dispatch({ type: "SET_ESPLOADER", payload: null });
            dispatch({ type: "SET_TRANSPORT", payload: null });
            dispatch({ type: "SET_CHIP", payload: null });
            dispatch({ type: "SET_IS_LOADING", payload: false });
        }
    }, [esploaderTerminal, logger]);

    const program = useCallback(
        async (
            files: ESPFile[],
            options?: Partial<Omit<FlashOptions, "fileArray" | "reportProgress" | "calculateMD5Hash">>
        ) => {
            if (!esploaderInstance.current || !state.isConnected) {
                const errorMsg = "Not connected in Program mode. Please connect to a device first.";
                logger.error(errorMsg);
                dispatch({ type: "SET_ERROR", payload: errorMsg });
                return;
            }
            logger.info(`Starting to program ${files.length} files`);
            dispatch({ type: "SET_IS_FLASHING", payload: true });
            dispatch({ type: "SET_ERROR", payload: null });

            const fileArray = files.map(f => ({
                data: f.data,
                address: f.address,
                name: f.fileName || `file_0x${f.address.toString(16)}`,
            }));
            logger.debug(
                "Files to flash",
                fileArray.map(f => ({ name: f.name, address: f.address }))
            );
            let fileIndex = 0;
            try {
                const flashOptions: FlashOptions = {
                    fileArray: fileArray,
                    flashSize: "keep",
                    flashMode: "keep",
                    flashFreq: "keep",
                    eraseAll: false,
                    compress: true,
                    reportProgress: (fIndex: number, written: number, total: number) => {
                        fileIndex = fIndex;
                        const progressPayload: FlashProgress = {
                            fileIndex: fIndex,
                            fileName: fileArray[fIndex]?.name || "Unknown file",
                            written,
                            total,
                        };
                        logger.debug(
                            `Flash progress: ${progressPayload.fileName} - ${Math.floor((written / total) * 100)}%`
                        );
                        dispatch({ type: "SET_FLASH_PROGRESS", payload: progressPayload });
                    },
                    calculateMD5Hash: (data: string) => {
                        // esptool-js passes binary data as base64 string, convert back to Uint8Array
                        const binaryString = atob(data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        return calculateMD5Hash(bytes);
                    },
                    ...options,
                };
                logger.debug("Flash options", { ...flashOptions, fileArray: undefined });
                await esploaderInstance.current.writeFlash(flashOptions);
                logger.info("Programming successful");
            } catch (e: any) {
                const errorMsg = e.message || "Failed to program";
                logger.error(`Error programming: ${errorMsg} (File: ${fileArray[fileIndex]?.name})`, e);
                dispatch({ type: "SET_ERROR", payload: errorMsg });
            } finally {
                dispatch({ type: "SET_IS_FLASHING", payload: false });
                dispatch({ type: "SET_FLASH_PROGRESS", payload: null });
            }
        },
        [state.isConnected, calculateMD5Hash, esploaderTerminal, logger]
    );

    const eraseFlash = useCallback(async () => {
        if (!esploaderInstance.current || !state.isConnected) {
            const errorMsg = "Not connected in Program mode. Please connect to a device first.";
            logger.error(errorMsg);
            dispatch({ type: "SET_ERROR", payload: errorMsg });
            return;
        }
        logger.info("Starting flash erasure");
        dispatch({ type: "SET_IS_ERASING", payload: true });
        dispatch({ type: "SET_ERROR", payload: null });
        try {
            logger.debug("Calling eraseFlash on ESP device");
            await esploaderInstance.current.eraseFlash();
            logger.info("Flash erased successfully");
        } catch (e: any) {
            const errorMsg = e.message || "Failed to erase flash";
            logger.error(`Error erasing flash: ${errorMsg}`, e);
            dispatch({ type: "SET_ERROR", payload: errorMsg });
        } finally {
            dispatch({ type: "SET_IS_ERASING", payload: false });
        }
    }, [state.isConnected, esploaderTerminal, logger]);

    const startConsole = useCallback(
        async (portToUse?: SerialPort) => {
            logger.info("Starting console mode");
            dispatch({ type: "SET_IS_LOADING", payload: true });
            dispatch({ type: "SET_ERROR", payload: null });

            // If program mode is connected, disconnect it first
            if (state.isConnected) {
                logger.info("Program mode active - disconnecting before console mode");
                await disconnect();

                // Wait longer for full cleanup and device reset before starting console
                logger.debug("Waiting for program mode cleanup and device reset before console startup");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (state.isConsoleConnected) {
                const msg = "Console already active or starting.";
                logger.warn(msg);
                dispatch({ type: "SET_IS_LOADING", payload: false });
                return;
            }

            // Clean up any leftover console device reference
            if (consoleDevice.current) {
                logger.debug("Cleaning up previous console device reference");
                try {
                    if (consoleDevice.current.readable) {
                        await consoleDevice.current.close();
                    }
                } catch (e) {
                    logger.debug("Error closing previous console device", e);
                }
                consoleDevice.current = null;
            }

            try {
                logger.debug("Getting serial instance for console");
                const serialControl = await getSerialInstance();
                const selectedPort = portToUse ?? (await serialControl.requestPort());

                if (!selectedPort) {
                    const msg = "No port selected for console.";
                    logger.error(msg);
                    dispatch({ type: "SET_ERROR", payload: msg });
                    dispatch({ type: "SET_IS_LOADING", payload: false });
                    return;
                }
                logger.debug("Console port selected", selectedPort);
                consoleDevice.current = selectedPort;

                // For console mode, we need to open the port ourselves since we're not using ESPLoader
                // First ensure port is closed
                if (consoleDevice.current.readable) {
                    logger.debug("Port already open, closing before console mode");
                    try {
                        await consoleDevice.current.close();
                        // Wait a moment for the port to fully close
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (e) {
                        logger.debug("Error closing port before console mode", e);
                    }
                }

                logger.debug(
                    `Opening console port at ${state.consoleBaudrate} baud with ${state.consoleDataBits}${state.consoleParity === "none" ? "N" : state.consoleParity.charAt(0).toUpperCase()}${state.consoleStopBits} configuration`
                );
                await consoleDevice.current.open({
                    baudRate: state.consoleBaudrate,
                    dataBits: state.consoleDataBits,
                    stopBits: state.consoleStopBits,
                    parity: state.consoleParity,
                });

                logger.debug("Creating console transport");
                consoleTransport.current = new ESPLoaderTransport(consoleDevice.current, state.debugLogging);

                keepConsoleReading.current = true;
                dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: true });
                logger.info(`Console mode connected at ${state.consoleBaudrate} baud`);

                // Check if readable stream exists and is not locked
                if (!consoleDevice.current.readable) {
                    throw new Error("No readable stream available from serial port");
                }

                // Check if the stream is already locked
                if (consoleDevice.current.readable.locked) {
                    logger.warn("ReadableStream is already locked, attempting to recover");

                    // Try to close and reopen the port to clear the lock
                    try {
                        await consoleDevice.current.close();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await consoleDevice.current.open({
                            baudRate: state.consoleBaudrate,
                            dataBits: state.consoleDataBits,
                            stopBits: state.consoleStopBits,
                            parity: state.consoleParity,
                        });

                        if (!consoleDevice.current.readable) {
                            throw new Error("Failed to reopen port for console mode");
                        }

                        if (consoleDevice.current.readable.locked) {
                            throw new Error(
                                "ReadableStream is still locked after recovery attempt. Please refresh the page and try again."
                            );
                        }
                    } catch (recoveryError: any) {
                        logger.error("Failed to recover from stream lock", recoveryError);
                        throw new Error(
                            `ReadableStream recovery failed: ${recoveryError.message}. Please refresh the page and try again.`
                        );
                    }
                }

                const reader = consoleDevice.current.readable.getReader();
                if (!reader) {
                    throw new Error("Failed to get reader for console.");
                }
                consoleReader.current = reader;

                // Protect against multiple concurrent read loops
                if (consoleReadingInProgress.current) {
                    logger.warn("Console reading already in progress, skipping duplicate start");
                    return;
                }

                consoleReadingInProgress.current = true;
                const textDecoder = new TextDecoder();

                (async () => {
                    logger.debug("Starting console read loop");
                    try {
                        while (keepConsoleReading.current && consoleReadingInProgress.current) {
                            try {
                                const { value, done } = await reader.read();
                                if (done) {
                                    logger.debug("Console reader signaled done");
                                    break;
                                }
                                if (value) {
                                    const decodedText = textDecoder.decode(value, { stream: true });
                                    logger.debug("Console data received", { length: value.length });
                                    esploaderTerminal.write(decodedText);
                                }
                            } catch (error: any) {
                                if (keepConsoleReading.current) {
                                    logger.error(`Console read error: ${error.message}`, error);
                                    dispatch({ type: "SET_ERROR", payload: `Console read error: ${error.message}` });
                                }
                                break;
                            }
                        }
                    } finally {
                        logger.debug("Console read loop ended");
                        consoleReadingInProgress.current = false;
                        try {
                            reader.releaseLock();
                        } catch (e) {
                            logger.debug("Error releasing reader lock", e);
                        }

                        if (!keepConsoleReading.current) {
                            logger.debug("Cleaning up console resources after stop");
                            if (consoleTransport.current) {
                                try {
                                    await consoleTransport.current.disconnect();
                                } catch (e) {
                                    logger.debug("Error disconnecting console transport", e);
                                }
                                consoleTransport.current = null;
                            }
                            if (consoleDevice.current && consoleDevice.current.readable) {
                                try {
                                    await consoleDevice.current.close();
                                } catch (e) {
                                    logger.debug("Error closing console device", e);
                                }
                            }
                            consoleDevice.current = null;
                            dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: false });
                        }
                    }
                })();
            } catch (e: any) {
                const errorMessage = e.message || "Failed to start console";
                logger.error(`Console startup error: ${errorMessage}`, e);
                dispatch({ type: "SET_ERROR", payload: errorMessage });
                if (consoleTransport.current) {
                    await consoleTransport.current.disconnect();
                }
                consoleTransport.current = null;
                if (consoleDevice.current && consoleDevice.current.readable) {
                    try {
                        await consoleDevice.current.close();
                    } catch (err) {
                        logger.debug("Error closing console device", err);
                        /* ignore */
                    }
                }
                consoleDevice.current = null;
                dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: false });
            } finally {
                dispatch({ type: "SET_IS_LOADING", payload: false });
            }
        },
        [
            state.consoleBaudrate,
            state.consoleDataBits,
            state.consoleStopBits,
            state.consoleParity,
            state.debugLogging,
            state.isConnected,
            disconnect,
            esploaderTerminal,
            logger,
        ]
    );

    const resetDevice = useCallback(async () => {
        // Can work in either program mode or console mode
        if (state.isConnected && esploaderInstance.current) {
            // Program mode reset
            logger.info("Resetting device via program mode");

            // Explicitly cast to ESPLoader to assure TypeScript of the type if inference is failing.
            const loader = esploaderInstance.current as ESPLoader;

            // Add retry logic for reset
            const maxRetries = 3;
            let attempt = 0;
            let success = false;

            while (attempt < maxRetries && !success) {
                try {
                    attempt++;
                    logger.debug(`Calling softReset (attempt ${attempt} of ${maxRetries})`);
                    await loader.softReset(false);
                    success = true;
                    logger.info("Device reset successfully via program mode");
                } catch (e: any) {
                    const errorMsg = e.message || "Failed to reset device";
                    logger.error(`Error resetting device (attempt ${attempt}): ${errorMsg}`, e);

                    if (attempt < maxRetries) {
                        const delayMs = 500 * attempt; // Increasing delay between retries
                        logger.debug(`Retrying reset in ${delayMs}ms`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        // Final failure after all retries
                        dispatch({ type: "SET_ERROR", payload: errorMsg });
                    }
                }
            }
        } else if (state.isConsoleConnected && consoleTransport.current) {
            // Console mode reset - implementation may vary
            logger.info("Attempting to reset device via console mode");

            try {
                // Send a reset command that works for your specific ESP devices
                // This might involve sending special bytes or DTR/RTS signals
                // through the consoleTransport

                // Example, may need customization:
                const encoder = new TextEncoder();
                await consoleTransport.current.write(encoder.encode("\x03")); // CTRL+C to stop any running program
                await new Promise(resolve => setTimeout(resolve, 100));

                // Simplified reset sequence matching the example:
                await consoleTransport.current.setDTR(false);
                await new Promise(resolve => setTimeout(resolve, 100));
                await consoleTransport.current.setDTR(true);

                logger.info("Reset signals sent via console mode");
            } catch (e: any) {
                const errorMsg = e.message || "Failed to reset device from console mode";
                logger.error(`Console reset error: ${errorMsg}`, e);
                dispatch({ type: "SET_ERROR", payload: errorMsg });
            }
        } else {
            const errorMsg = "Not connected in any mode. Please connect to a device first.";
            logger.error(errorMsg);
            dispatch({ type: "SET_ERROR", payload: errorMsg });
        }
    }, [state.isConnected, state.isConsoleConnected, esploaderTerminal, logger]);

    const getTrace = useCallback(async (): Promise<string[]> => {
        if (!state.isConnected && !state.isConsoleConnected) {
            logger.warn("Trace requested but not connected in any mode");
            return [];
        }
        logger.debug("Returning recent terminal output for trace");
        return state.terminalOutput.slice(-50);
    }, [state.isConnected, state.isConsoleConnected, esploaderTerminal, state.terminalOutput, logger]);

    const setBaudrate = useCallback(
        (rate: number) => {
            logger.info(`Setting program mode baudrate to ${rate}`);
            dispatch({ type: "SET_BAUDRATE", payload: rate });
            // Note: romBaudrate is not updated here, it's set from initial prop or defaults to this baudrate at connection time
        },
        [esploaderTerminal, logger]
    );

    const setConsoleBaudrate = useCallback(
        (rate: number) => {
            logger.info(`Setting console mode baudrate to ${rate}`);
            dispatch({ type: "SET_CONSOLE_BAUDRATE", payload: rate });
        },
        [esploaderTerminal, logger]
    );

    const setConsoleDataBits = useCallback(
        (bits: 7 | 8) => {
            logger.info(`Setting console mode data bits to ${bits}`);
            dispatch({ type: "SET_CONSOLE_DATA_BITS", payload: bits });
        },
        [esploaderTerminal, logger]
    );

    const setConsoleStopBits = useCallback(
        (bits: 1 | 2) => {
            logger.info(`Setting console mode stop bits to ${bits}`);
            dispatch({ type: "SET_CONSOLE_STOP_BITS", payload: bits });
        },
        [esploaderTerminal, logger]
    );

    const setConsoleParity = useCallback(
        (parity: "none" | "even" | "odd") => {
            logger.info(`Setting console mode parity to ${parity}`);
            dispatch({ type: "SET_CONSOLE_PARITY", payload: parity });
        },
        [esploaderTerminal, logger]
    );

    const setDebugLogging = useCallback(
        (enabled: boolean) => {
            logger.info(`${enabled ? "Enabling" : "Disabling"} debug logging`);
            dispatch({ type: "SET_DEBUG_LOGGING", payload: enabled });
        },
        [esploaderTerminal, logger]
    );

    const clearTerminal = useCallback(() => {
        logger.debug("Clearing terminal output");
        dispatch({ type: "CLEAR_TERMINAL_OUTPUT" });
    }, [logger]);

    useEffect(() => {
        const programTransportRef = programTransport.current;
        const consoleTransportRef = consoleTransport.current;
        const programDeviceRef = programDevice.current;
        const consolePortRef = consoleDevice.current;

        logger.debug("Setting up ESPLoader component cleanup");

        return () => {
            logger.info("Cleaning up ESPLoader provider resources");
            keepConsoleReading.current = false;

            if (consoleReader.current) {
                logger.debug("Cancelling console reader in cleanup");
                consoleReader.current.cancel().catch(e => {
                    logger.warn("Error cancelling console reader during cleanup", e);
                });
            }

            if (consoleTransportRef) {
                logger.debug("Disconnecting console transport in cleanup");
                consoleTransportRef.disconnect().catch(e => {
                    logger.error("Error during console transport disconnect:", e);
                    console.error("Error during console transport disconnect:", e);
                });
            }
            if (consolePortRef && consolePortRef.readable) {
                logger.debug("Closing console port in cleanup");
                consolePortRef.close().catch(e => {
                    logger.error("Error closing console device port:", e);
                    console.error("Error closing console device port:", e);
                });
            }

            if (programTransportRef && state.isConnected) {
                // Only disconnect main transport if it was connected
                logger.debug("Disconnecting program transport in cleanup");
                programTransportRef.disconnect().catch(e => {
                    logger.error("Error during program transport disconnect:", e);
                    console.error("Error during program transport disconnect:", e);
                });
            }
            // Close main device port if it's open, regardless of state.isConnected, as it might be open from a failed attempt
            if (programDeviceRef && programDeviceRef.readable) {
                logger.debug("Closing program device port in cleanup");
                programDeviceRef.close().catch(e => {
                    logger.error("Error closing program device port:", e);
                    console.error("Error closing program device port:", e);
                });
            }

            esploaderInstance.current = null;
            programTransport.current = null;
            programDevice.current = null;
            consoleTransport.current = null;
            consoleDevice.current = null;
            logger.debug("ESPLoader provider cleanup complete");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logger]); // Added logger to the dependency array

    // Connection health monitoring
    const checkConnection = useCallback(async (): Promise<boolean> => {
        if (!esploaderInstance.current || !state.isConnected) {
            logger.debug("checkConnection: Not connected in program mode");
            return false;
        }

        try {
            logger.debug("Checking program mode connection health");
            const loader = esploaderInstance.current as ESPLoader;

            // A lightweight command to check if connection is still good
            await loader.sync();
            logger.debug("Program mode connection check: Healthy");
            return true;
        } catch (e: any) {
            logger.warn(`Program mode connection check failed: ${e.message}`, e);
            return false;
        }
    }, [state.isConnected, logger]);

    // Attempt to restore connection if issues detected
    const attemptConnectionRecovery = useCallback(async (): Promise<boolean> => {
        if (!programDevice.current || !state.isConnected) {
            logger.debug("Recovery not attempted: No device or not connected in program mode");
            return false;
        }

        logger.info("Attempting to recover program mode connection");

        try {
            // First try to disconnect cleanly
            if (programTransport.current) {
                logger.debug("Recovery: Disconnecting program transport");
                await programTransport.current.disconnect().catch(e => {
                    logger.error("Error during recovery disconnect", e);
                });
            }

            // Wait a moment for the device to reset
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try to reconnect
            logger.debug("Recovery: Reconnecting to program mode");
            const result = await connect(programDevice.current);

            if (result) {
                logger.info("Program mode connection recovered successfully");
                return true;
            } else {
                logger.warn("Program mode connection recovery failed");
                return false;
            }
        } catch (e: any) {
            logger.error(`Program mode connection recovery failed: ${e.message}`, e);
            return false;
        }
    }, [state.isConnected, connect, logger, esploaderTerminal]);

    const actions: ESPLoaderActions = useMemo(
        () => ({
            connect,
            disconnect,
            program,
            eraseFlash,
            startConsole,
            stopConsole,
            resetDevice,
            getTrace,
            setBaudrate,
            setConsoleBaudrate,
            setConsoleDataBits,
            setConsoleStopBits,
            setConsoleParity,
            setDebugLogging,
            clearTerminal,
            checkConnection,
            attemptConnectionRecovery,
        }),
        [
            connect,
            disconnect,
            program,
            eraseFlash,
            startConsole,
            stopConsole,
            resetDevice,
            getTrace,
            setBaudrate,
            setConsoleBaudrate,
            setConsoleDataBits,
            setConsoleStopBits,
            setConsoleParity,
            setDebugLogging,
            clearTerminal,
            checkConnection,
            attemptConnectionRecovery,
        ]
    );

    return <ESPLoaderContext.Provider value={{ state, actions }}>{children}</ESPLoaderContext.Provider>;
};
