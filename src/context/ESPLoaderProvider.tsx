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
                .map((_, i) => data[i].toString(16).padStart(2, '0'))
                .join(' ');
                
            // Try to interpret as ASCII if reasonable
            let asciiView = '';
            try {
                // Only show ASCII for printable characters
                asciiView = new Array(Math.min(data.length, 32))
                    .fill(0)
                    .map((_, i) => {
                        const char = data[i];
                        return (char >= 32 && char <= 126) ? String.fromCharCode(char) : '.';
                    })
                    .join('');
            } catch (e) {
                asciiView = '[non-printable]';
            }
            
            console.debug(`[ESPLoader Serial] ${context}: ${data.length} bytes`);
            console.debug(`[ESPLoader Serial] Hex: ${hexView}${data.length > 32 ? '...' : ''}`);
            console.debug(`[ESPLoader Serial] ASCII: ${asciiView}${data.length > 32 ? '...' : ''}`);
        }
    };
};

// Augment the Navigator interface to include the 'serial' property
declare global {
    interface Navigator {
        serial?: Serial;
    }
    // Define a minimal Serial interface based on W3C Web Serial API
    // For full types, consider adding `@types/w3c-web-serial` as a dev dependency
    interface Serial {
        requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
        getPorts(): Promise<SerialPort[]>;
    }
    interface SerialPortRequestOptions {
        filters?: SerialPortFilter[];
    }
    interface SerialPortFilter {
        usbVendorId?: number;
        usbProductId?: number;
    }
    // SerialPort is already declared globally in src/types.ts, but we ensure it here as well for clarity
    // interface SerialPort { /* ... */ }
}

// Global types for Serial API are in src/types.ts

// Helper to get navigator.serial or a polyfill
async function getSerialInstance(): Promise<Serial> {
    // Serial type comes from global types
    if (navigator.serial) {
        return navigator.serial;
    }
    // Import the polyfill for its side-effects, then check navigator.serial again.
    await import("web-serial-polyfill");
    if (navigator.serial) {
        return navigator.serial;
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
        baudrate: initialBaudrate ?? 921600, // Default to 921600 like the example
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

    // Helper to reset ESP device into bootloader mode
    const resetToBootloader = useCallback(async (port: SerialPort): Promise<void> => {
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
            await new Promise(resolve => setTimeout(resolve, 750));  // Give it more time
            
            // Don't disconnect the transport as it might close buffers we need
            // Just leave it for garbage collection
            
            logger.debug("Reset to bootloader sequence completed");
        } catch (e: any) {
            logger.warn(`Failed to reset to bootloader: ${e.message}`, e);
            // Continue anyway, might still work
        }
    }, [state.debugLogging, logger]);

    const esploaderTerminal = useMemo(
        () => ({
            clean() {
                dispatch({ type: "CLEAR_TERMINAL_OUTPUT" });
            },
            writeLine(data: string) {
                dispatch({ type: "ADD_TERMINAL_OUTPUT", payload: data });
            },
            write(data: string) {
                dispatch({
                    type: "SET_TERMINAL_OUTPUT",
                    payload:
                        state.terminalOutput.length > 0 &&
                        !state.terminalOutput[state.terminalOutput.length - 1].endsWith("\n")
                            ? [
                                  ...state.terminalOutput.slice(0, -1),
                                  state.terminalOutput[state.terminalOutput.length - 1] + data,
                              ]
                            : [...state.terminalOutput, data],
                });
            },
        }),
        [state.terminalOutput]
    );

    // Define stopConsole before it's used in connect
    const stopConsole = useCallback(async () => {
        logger.info("Stopping console mode");
        esploaderTerminal.writeLine("Stopping console mode...");
        keepConsoleReading.current = false;

        if (consoleReader.current) {
            try {
                logger.debug("Cancelling console reader");
                await consoleReader.current.cancel();
            } catch (e: any) {
                logger.warn(`Error cancelling console reader: ${e.message}`, e);
                esploaderTerminal.writeLine(`Note: Error cancelling console reader: ${e.message}`);
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
        esploaderTerminal.writeLine("Console mode stopped.");
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
                esploaderTerminal.writeLine("Stopping console before entering program mode...");
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

                // Create transport without attempting to open the port first
                // Let the ESPLoader library handle device initialization
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
                    romBaudrate: loaderOpts.romBaudrate
                });
                const loader = new ESPLoader(loaderOpts);
                esploaderInstance.current = loader;

                logger.debug("Initializing main loader");
                try {
                    await loader.main();
                } catch (connectError: any) {
                    // Handle specific connection errors
                    if (connectError.message?.includes("timeout")) {
                        logger.error("Connection timeout occurred", connectError);
                        throw new Error(
                            "Connection timeout. Make sure your device is in bootloader mode or try pressing the BOOT button during connection."
                        );
                    } else if (connectError.message?.includes("invalid data")) {
                        logger.error("Invalid data received from device", connectError);
                        throw new Error(
                            "Invalid data received from device. Try a different baudrate or check your USB connection."
                        );
                    }
                    throw connectError; // Re-throw if not a specific error we handle
                }

                logger.info(`Successfully connected to ESP device in Program mode: ${loader.chip.CHIP_NAME}`);
                dispatch({ type: "SET_ESPLOADER", payload: loader });
                dispatch({
                    type: "SET_TRANSPORT",
                    payload: transport as unknown as Transport,
                });
                dispatch({ type: "SET_IS_CONNECTED", payload: true });
                dispatch({ type: "SET_CHIP", payload: loader.chip.CHIP_NAME });
                esploaderTerminal.writeLine(`Connected to ${loader.chip.CHIP_NAME} in Program mode`);
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
                
                esploaderTerminal.writeLine(`Error connecting in Program mode: ${userMessage}`);
                dispatch({ type: "SET_ERROR", payload: userMessage });
                dispatch({ type: "SET_IS_CONNECTED", payload: false });
                if (programTransport.current) {
                    logger.debug("Disconnecting transport after error");
                    await programTransport.current.disconnect();
                }
                return "";
            } finally {
                dispatch({ type: "SET_IS_LOADING", payload: false });
            }
        },
        [state.baudrate, state.debugLogging, state.isConsoleConnected, stopConsole, esploaderTerminal, romBaudrate, logger]
    );

    const disconnect = useCallback(async () => {
        logger.info("Disconnecting from ESP device in Program mode");
        dispatch({ type: "SET_IS_LOADING", payload: true });
        try {
            if (programTransport.current) {
                logger.debug("Disconnecting program transport");
                await programTransport.current.disconnect();
            }
            logger.info("Successfully disconnected from program mode");
            esploaderTerminal.writeLine("Program mode disconnected.");
            dispatch({ type: "RESET_STATE" });
            programDevice.current = null;
            programTransport.current = null;
            esploaderInstance.current = null;
        } catch (e: any) {
            const errorMessage = e.message || "Failed to disconnect";
            logger.error(`Disconnect error: ${errorMessage}`, e);
            esploaderTerminal.writeLine(`Error: ${errorMessage}`);
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
                esploaderTerminal.writeLine(errorMsg);
                dispatch({ type: "SET_ERROR", payload: errorMsg });
                return;
            }
            logger.info(`Starting to program ${files.length} files`);
            dispatch({ type: "SET_IS_FLASHING", payload: true });
            dispatch({ type: "SET_ERROR", payload: null });
            esploaderTerminal.writeLine("Starting programming...");

            const fileArray = files.map(f => ({
                data: f.data,
                address: f.address,
                name: f.fileName || `file_0x${f.address.toString(16)}`,
            }));
            logger.debug("Files to flash", fileArray.map(f => ({ name: f.name, address: f.address })));
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
                        logger.debug(`Flash progress: ${progressPayload.fileName} - ${Math.floor((written / total) * 100)}%`);
                        dispatch({ type: "SET_FLASH_PROGRESS", payload: progressPayload });
                        esploaderTerminal.writeLine(
                            `Flashing ${progressPayload.fileName}: ${Math.floor((written / total) * 100)}%`
                        );
                    },
                    calculateMD5Hash: (data: string) => calculateMD5Hash(new TextEncoder().encode(data)),
                    ...options,
                };
                logger.debug("Flash options", { ...flashOptions, fileArray: undefined });
                await esploaderInstance.current.writeFlash(flashOptions);
                logger.info("Programming successful");
                esploaderTerminal.writeLine("Programming successful.");
            } catch (e: any) {
                const errorMsg = e.message || "Failed to program";
                logger.error(`Error programming: ${errorMsg} (File: ${fileArray[fileIndex]?.name})`, e);
                esploaderTerminal.writeLine(`Error programming: ${errorMsg} (File: ${fileArray[fileIndex]?.name})`);
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
            esploaderTerminal.writeLine(errorMsg);
            dispatch({ type: "SET_ERROR", payload: errorMsg });
            return;
        }
        logger.info("Starting flash erasure");
        dispatch({ type: "SET_IS_ERASING", payload: true });
        dispatch({ type: "SET_ERROR", payload: null });
        esploaderTerminal.writeLine("Starting erase...");
        try {
            logger.debug("Calling eraseFlash on ESP device");
            await esploaderInstance.current.eraseFlash();
            logger.info("Flash erased successfully");
            esploaderTerminal.writeLine("Flash erased successfully.");
        } catch (e: any) {
            const errorMsg = e.message || "Failed to erase flash";
            logger.error(`Error erasing flash: ${errorMsg}`, e);
            esploaderTerminal.writeLine(`Error erasing flash: ${errorMsg}`);
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
            esploaderTerminal.writeLine("Attempting to start console mode...");

            // If program mode is connected, disconnect it first
            if (state.isConnected) {
                logger.info("Program mode active - disconnecting before console mode");
                esploaderTerminal.writeLine("Disconnecting from program mode before starting console...");
                await disconnect();
            }

            if (consoleDevice.current || state.isConsoleConnected) {
                const msg = "Console already active or starting.";
                logger.warn(msg);
                esploaderTerminal.writeLine(msg);
                dispatch({ type: "SET_IS_LOADING", payload: false });
                return;
            }

            try {
                logger.debug("Getting serial instance for console");
                const serialControl = await getSerialInstance();
                const selectedPort = portToUse ?? await serialControl.requestPort();

                if (!selectedPort) {
                    const msg = "No port selected for console.";
                    logger.error(msg);
                    esploaderTerminal.writeLine(msg);
                    dispatch({ type: "SET_ERROR", payload: msg });
                    dispatch({ type: "SET_IS_LOADING", payload: false });
                    return;
                }
                logger.debug("Console port selected", selectedPort);
                consoleDevice.current = selectedPort;

                if (!consoleDevice.current.readable) {
                    logger.debug(`Opening console port at ${state.consoleBaudrate} baud`);
                    await consoleDevice.current.open({ baudRate: state.consoleBaudrate });
                }

                logger.debug("Creating console transport");
                consoleTransport.current = new ESPLoaderTransport(consoleDevice.current, state.debugLogging);

                keepConsoleReading.current = true;
                dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: true });
                logger.info(`Console mode connected at ${state.consoleBaudrate} baud`);
                esploaderTerminal.writeLine(`Console mode active at ${state.consoleBaudrate} baud.`);

                const reader = consoleDevice.current.readable?.getReader();
                if (!reader) {
                    throw new Error("Failed to get reader for console.");
                }
                consoleReader.current = reader;

                const textDecoder = new TextDecoder();
                (async () => {
                    logger.debug("Starting console read loop");
                    while (keepConsoleReading.current) {
                        try {
                            const { value, done } = await reader.read();
                            if (done) {
                                logger.debug("Console reader signaled done");
                                esploaderTerminal.writeLine("Console reader closed.");
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
                                esploaderTerminal.writeLine(`Console error: ${error.message}`);
                            }
                            break;
                        }
                    }
                    logger.debug("Console read loop ended");
                    reader.releaseLock();
                    if (!keepConsoleReading.current) {
                        logger.debug("Cleaning up console resources after stop");
                        if (consoleTransport.current) {
                            await consoleTransport.current.disconnect();
                            consoleTransport.current = null;
                        }
                        if (consoleDevice.current && consoleDevice.current.readable) {
                            await consoleDevice.current.close();
                        }
                        consoleDevice.current = null;
                        dispatch({ type: "SET_IS_CONSOLE_CONNECTED", payload: false });
                    }
                })();
            } catch (e: any) {
                const errorMessage = e.message || "Failed to start console";
                logger.error(`Console startup error: ${errorMessage}`, e);
                esploaderTerminal.writeLine(`Console Error: ${errorMessage}`);
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
        [state.consoleBaudrate, state.debugLogging, state.isConnected, disconnect, esploaderTerminal, logger]
    );

    const resetDevice = useCallback(async () => {
        // Can work in either program mode or console mode
        if (state.isConnected && esploaderInstance.current) {
            // Program mode reset
            logger.info("Resetting device via program mode");
            esploaderTerminal.writeLine("Attempting to reset device via program mode...");
            
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
                    esploaderTerminal.writeLine("Device reset command sent successfully.");
                } catch (e: any) {
                    const errorMsg = e.message || "Failed to reset device";
                    logger.error(`Error resetting device (attempt ${attempt}): ${errorMsg}`, e);
                    
                    if (attempt < maxRetries) {
                        const delayMs = 500 * attempt; // Increasing delay between retries
                        logger.debug(`Retrying reset in ${delayMs}ms`);
                        esploaderTerminal.writeLine(`Reset failed, retrying in ${delayMs/1000} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        // Final failure after all retries
                        esploaderTerminal.writeLine(`Error resetting device after ${maxRetries} attempts: ${errorMsg}`);
                        dispatch({ type: "SET_ERROR", payload: errorMsg });
                    }
                }
            }
        } else if (state.isConsoleConnected && consoleTransport.current) {
            // Console mode reset - implementation may vary
            logger.info("Attempting to reset device via console mode");
            esploaderTerminal.writeLine("Attempting to reset device via console mode...");
            
            try {
                // Send a reset command that works for your specific ESP devices
                // This might involve sending special bytes or DTR/RTS signals
                // through the consoleTransport
                
                // Example, may need customization:
                const encoder = new TextEncoder();
                await consoleTransport.current.write(encoder.encode('\x03')); // CTRL+C to stop any running program
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Simplified reset sequence matching the example:
                await consoleTransport.current.setDTR(false);
                await new Promise(resolve => setTimeout(resolve, 100));
                await consoleTransport.current.setDTR(true);
                
                logger.info("Reset signals sent via console mode");
                esploaderTerminal.writeLine("Reset signals sent. Device should restart.");
            } catch (e: any) {
                const errorMsg = e.message || "Failed to reset device from console mode";
                logger.error(`Console reset error: ${errorMsg}`, e);
                esploaderTerminal.writeLine(`Reset error: ${errorMsg}`);
                dispatch({ type: "SET_ERROR", payload: errorMsg });
            }
        } else {
            const errorMsg = "Not connected in any mode. Please connect to a device first.";
            logger.error(errorMsg);
            esploaderTerminal.writeLine(errorMsg);
            dispatch({ type: "SET_ERROR", payload: errorMsg });
        }
    }, [state.isConnected, state.isConsoleConnected, esploaderTerminal, logger]);

    const getTrace = useCallback(async (): Promise<string[]> => {
        if (!state.isConnected && !state.isConsoleConnected) {
            logger.warn("Trace requested but not connected in any mode");
            esploaderTerminal.writeLine("Not connected in any mode. Cannot get trace.");
            return [];
        }
        logger.debug("Returning recent terminal output for trace");
        esploaderTerminal.writeLine("Trace: Returning recent terminal output.");
        return state.terminalOutput.slice(-50);
    }, [state.isConnected, state.isConsoleConnected, esploaderTerminal, state.terminalOutput, logger]);

    const setBaudrate = useCallback(
        (rate: number) => {
            logger.info(`Setting program mode baudrate to ${rate}`);
            dispatch({ type: "SET_BAUDRATE", payload: rate });
            // Note: romBaudrate is not updated here, it's set from initial prop or defaults to this baudrate at connection time
            if (esploaderInstance.current) {
                esploaderTerminal.writeLine(
                    `Program mode baudrate set to ${rate}. Please reconnect for this to take effect on the current session.`
                );
            } else {
                esploaderTerminal.writeLine(`Program mode baudrate set to ${rate}.`);
            }
        },
        [esploaderTerminal, logger]
    );

    const setConsoleBaudrate = useCallback(
        (rate: number) => {
            logger.info(`Setting console mode baudrate to ${rate}`);
            dispatch({ type: "SET_CONSOLE_BAUDRATE", payload: rate });
            esploaderTerminal.writeLine(
                `Console mode baudrate set to ${rate}. Restart console if active for changes to apply.`
            );
        },
        [esploaderTerminal, logger]
    );

    const setDebugLogging = useCallback(
        (enabled: boolean) => {
            logger.info(`${enabled ? "Enabling" : "Disabling"} debug logging`);
            dispatch({ type: "SET_DEBUG_LOGGING", payload: enabled });
            esploaderTerminal.writeLine(
                `Debug logging ${
                    enabled ? "enabled" : "disabled"
                }. Please reconnect or restart console for this to take full effect.`
            );
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
                consoleReader.current.cancel().catch((e) => {
                    logger.warn("Error cancelling console reader during cleanup", e);
                });
            }

            if (consoleTransportRef) {
                logger.debug("Disconnecting console transport in cleanup");
                consoleTransportRef
                    .disconnect()
                    .catch(e => {
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
        esploaderTerminal.writeLine("Attempting to recover program mode connection...");
        
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
                esploaderTerminal.writeLine("Program mode connection recovered successfully.");
                return true;
            } else {
                logger.warn("Program mode connection recovery failed");
                esploaderTerminal.writeLine("Program mode connection recovery failed. Please reconnect manually.");
                return false;
            }
        } catch (e: any) {
            logger.error(`Program mode connection recovery failed: ${e.message}`, e);
            esploaderTerminal.writeLine(`Program mode connection recovery failed: ${e.message}`);
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
            setDebugLogging,
            clearTerminal,
            checkConnection,
            attemptConnectionRecovery
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
            setDebugLogging,
            clearTerminal,
            checkConnection,
            attemptConnectionRecovery
        ]
    );

    return <ESPLoaderContext.Provider value={{ state, actions }}>{children}</ESPLoaderContext.Provider>;
};
