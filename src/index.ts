export * from "./context/ESPLoaderContext";
export { ESPLoaderProvider } from "./context/ESPLoaderProvider";
export { useEspLoader } from "./hooks/useEspLoader";
export { useWebSerialCompatibility } from "./hooks/useWebSerialCompatibility";
export type {
    ChipFirmwareRequirements,
    ESPFile,
    ESPLoader,
    ESPLoaderActions,
    ESPLoaderState,
    FileValidationResult,
    FirmwareFileInfo,
    // Firmware guidance types
    FirmwareFileType,
    FirmwareValidationSummary,
    FlashOptions,
    FlashProgress,
    Transport,
    WebSerialCompatibility,
} from "./types";

export type { UseWebSerialCompatibilityResult } from "./hooks/useWebSerialCompatibility";

// Firmware guidance utilities
export {
    CHIP_REQUIREMENTS,
    detectFileType,
    generatePreset,
    getChipRequirements,
    validateFile,
    validateFirmwareSet,
} from "./utils/firmwareGuidance";

// Browser compatibility utilities
export { detectWebSerialCompatibility, testWebSerialFunctionality } from "./utils/browserCompatibility";
