import type { ESPLoaderState, FlashProgress, Transport } from "../types";
import type { ESPLoader } from "esptool-js";

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
    | { type: "SET_TERMINAL_OUTPUT"; payload: string[] }
    | { type: "CLEAR_TERMINAL_OUTPUT" }
    | { type: "SET_FLASH_PROGRESS"; payload: FlashProgress | null }
    | { type: "SET_BAUDRATE"; payload: number }
    | { type: "SET_CONSOLE_BAUDRATE"; payload: number }
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
        case "SET_DEBUG_LOGGING":
            return { ...state, debugLogging: action.payload };
        case "RESET_STATE":
            return {
                ...initialESPLoaderState,
                // Preserve user-settable defaults if needed, or reset all
                baudrate: state.baudrate,
                consoleBaudrate: state.consoleBaudrate,
                debugLogging: state.debugLogging,
            };
        default:
            return state;
    }
}
