import type { FlashOptions, ESPLoader } from "esptool-js";

export interface ESPFile {
    data: string;
    address: number;
    fileName?: string;
}

export interface FlashProgress {
    fileIndex: number;
    fileName: string;
    written: number;
    total: number;
}

// Re-exporting some types from esptool-js for convenience if consumers need them.
// Consumers can also import them directly from 'esptool-js'.
export type { FlashOptions, ESPLoader };

export interface ESPLoaderState {
    transport: Transport | null;
    esploader: ESPLoader | null;
    chip: string | null;
    isConnected: boolean;
    isConsoleConnected: boolean;
    isLoading: boolean;
    isFlashing: boolean;
    isErasing: boolean;
    error: Error | string | null;
    terminalOutput: string[];
    flashProgress: FlashProgress | null;
    baudrate: number;
    consoleBaudrate: number;
    debugLogging: boolean;
}

export interface ESPLoaderActions {
    connect: (port?: SerialPort) => Promise<string>;
    disconnect: () => Promise<void>;
    program: (
        files: ESPFile[],
        options?: Partial<Omit<FlashOptions, "fileArray" | "reportProgress" | "calculateMD5Hash">>
    ) => Promise<void>;
    eraseFlash: () => Promise<void>;
    startConsole: (port?: SerialPort) => Promise<void>;
    stopConsole: () => Promise<void>;
    resetDevice: () => Promise<void>;
    getTrace: () => Promise<string[]>; // Assuming this would return an array of trace messages
    setBaudrate: (rate: number) => void;
    setConsoleBaudrate: (rate: number) => void;
    setDebugLogging: (enabled: boolean) => void;
    clearTerminal: () => void;
    // Connection health monitoring functions
    checkConnection: () => Promise<boolean>;
    attemptConnectionRecovery: () => Promise<boolean>;
}

// Assuming Transport is a type from esptool-js or a related library
// If not, we might need to define it or import it from the correct source.
// For now, let's declare it as any to proceed.
// Ideally, this 'Transport' type would come from 'esptool-js' or a similar well-known WebSerial library.
export type Transport = any;

// Similarly, SerialPort is part of the Web Serial API standard.
// We can use the types from '@types/w3c-web-serial' if added as a dev dependency,
// or declare a minimal interface here.
declare global {
    interface SerialPort {
        readonly readable: ReadableStream<Uint8Array> | null;
        readonly writable: WritableStream<Uint8Array> | null;
        open(options: SerialOptions): Promise<void>;
        close(): Promise<void>;
        getInfo(): SerialPortInfo;
        getSignals?(): Promise<SerialInputSignals>; // Optional as per spec updates
        setSignals?(signals: SerialOutputSignals): Promise<void>; // Optional
        // Add other methods/properties if needed by the library e.g. forget()
        addEventListener(
            type: "disconnect" | "connect",
            listener: (this: SerialPort, ev: Event) => any,
            options?: boolean | AddEventListenerOptions
        ): void;
        removeEventListener(
            type: "disconnect" | "connect",
            listener: (this: SerialPort, ev: Event) => any,
            options?: boolean | EventListenerOptions
        ): void;
    }

    interface SerialOptions {
        baudRate: number;
        dataBits?: 7 | 8;
        stopBits?: 1 | 2;
        parity?: "none" | "even" | "odd";
        bufferSize?: number;
        flowControl?: "none" | "hardware";
    }

    interface SerialPortInfo {
        usbVendorId?: number;
        usbProductId?: number;
    }

    interface SerialInputSignals {
        dataCarrierDetect: boolean;
        clearToSend: boolean;
        ringIndicator: boolean;
        dataSetReady: boolean;
    }

    interface SerialOutputSignals {
        dataTerminalReady?: boolean;
        requestToSend?: boolean;
        break?: boolean;
    }

    // Navigator augmentation for navigator.serial (if not already handled by tsconfig lib or @types/w3c-web-serial)
    interface Navigator {
        serial?: Serial;
    }

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
}
