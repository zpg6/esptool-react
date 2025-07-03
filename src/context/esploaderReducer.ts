import type { ESPLoader } from "esptool-js";
import type { ESPLoaderState, FlashProgress, Transport } from "../types";

export const initialESPLoaderState: ESPLoaderState = {
    transport: null,
    esploader: null,
    chip: null,
    isConnected: false,
    isConsoleConnected: false,
    isLoading: false,
    isFlashing: false,
    isErasing: false,
    error: null,
    terminalOutput: [],
    flashProgress: null,
    baudrate: 115200, // Default baudrate from esptool-js example
    consoleBaudrate: 115200, // Default console baudrate
    consoleDataBits: 8, // Default to 8 data bits for 8N1
    consoleStopBits: 1, // Default to 1 stop bit for 8N1
    consoleParity: "none", // Default to no parity for 8N1
    debugLogging: false,
};

export type Action =
    | { type: "SET_TRANSPORT"; payload: Transport | null }
    | { type: "SET_ESPLOADER"; payload: ESPLoader | null }
    | { type: "SET_CHIP"; payload: string | null }
    | { type: "SET_IS_CONNECTED"; payload: boolean }
    | { type: "SET_IS_CONSOLE_CONNECTED"; payload: boolean }
    | { type: "SET_IS_LOADING"; payload: boolean }
    | { type: "SET_IS_FLASHING"; payload: boolean }
    | { type: "SET_IS_ERASING"; payload: boolean }
    | { type: "SET_ERROR"; payload: Error | string | null }
    | { type: "ADD_TERMINAL_OUTPUT"; payload: string }
    | { type: "APPEND_TERMINAL_OUTPUT"; payload: string }
    | { type: "SET_TERMINAL_OUTPUT"; payload: string[] }
    | { type: "CLEAR_TERMINAL_OUTPUT" }
    | { type: "SET_FLASH_PROGRESS"; payload: FlashProgress | null }
    | { type: "SET_BAUDRATE"; payload: number }
    | { type: "SET_CONSOLE_BAUDRATE"; payload: number }
    | { type: "SET_CONSOLE_DATA_BITS"; payload: 7 | 8 }
    | { type: "SET_CONSOLE_STOP_BITS"; payload: 1 | 2 }
    | { type: "SET_CONSOLE_PARITY"; payload: "none" | "even" | "odd" }
    | { type: "SET_DEBUG_LOGGING"; payload: boolean }
    | { type: "RESET_STATE" };

export function esploaderReducer(state: ESPLoaderState, action: Action): ESPLoaderState {
    switch (action.type) {
        case "SET_TRANSPORT":
            return { ...state, transport: action.payload };
        case "SET_ESPLOADER":
            return { ...state, esploader: action.payload };
        case "SET_CHIP":
            return { ...state, chip: action.payload };
        case "SET_IS_CONNECTED":
            return { ...state, isConnected: action.payload, isLoading: false, error: null };
        case "SET_IS_CONSOLE_CONNECTED":
            return { ...state, isConsoleConnected: action.payload, isLoading: false, error: null };
        case "SET_IS_LOADING":
            return { ...state, isLoading: action.payload };
        case "SET_IS_FLASHING":
            return { ...state, isFlashing: action.payload, error: null };
        case "SET_IS_ERASING":
            return { ...state, isErasing: action.payload, error: null };
        case "SET_ERROR":
            return { ...state, error: action.payload, isLoading: false, isFlashing: false, isErasing: false };
        case "ADD_TERMINAL_OUTPUT":
            return { ...state, terminalOutput: [...state.terminalOutput, action.payload] };
        case "APPEND_TERMINAL_OUTPUT":
            return {
                ...state,
                terminalOutput:
                    state.terminalOutput.length > 0 &&
                    !state.terminalOutput[state.terminalOutput.length - 1].endsWith("\n")
                        ? [
                              ...state.terminalOutput.slice(0, -1),
                              state.terminalOutput[state.terminalOutput.length - 1] + action.payload,
                          ]
                        : [...state.terminalOutput, action.payload],
            };
        case "SET_TERMINAL_OUTPUT":
            return { ...state, terminalOutput: action.payload };
        case "CLEAR_TERMINAL_OUTPUT":
            return { ...state, terminalOutput: [] };
        case "SET_FLASH_PROGRESS":
            return { ...state, flashProgress: action.payload };
        case "SET_BAUDRATE":
            return { ...state, baudrate: action.payload };
        case "SET_CONSOLE_BAUDRATE":
            return { ...state, consoleBaudrate: action.payload };
        case "SET_CONSOLE_DATA_BITS":
            return { ...state, consoleDataBits: action.payload };
        case "SET_CONSOLE_STOP_BITS":
            return { ...state, consoleStopBits: action.payload };
        case "SET_CONSOLE_PARITY":
            return { ...state, consoleParity: action.payload };
        case "SET_DEBUG_LOGGING":
            return { ...state, debugLogging: action.payload };
        case "RESET_STATE":
            return {
                ...initialESPLoaderState,
                // Preserve user-settable defaults if needed, or reset all
                baudrate: state.baudrate,
                consoleBaudrate: state.consoleBaudrate,
                consoleDataBits: state.consoleDataBits,
                consoleStopBits: state.consoleStopBits,
                consoleParity: state.consoleParity,
                debugLogging: state.debugLogging,
            };
        default:
            return state;
    }
}
