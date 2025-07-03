export * from "./context/ESPLoaderContext";
export { ESPLoaderProvider } from "./context/ESPLoaderProvider";
export { useEspLoader } from "./hooks/useEspLoader";
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
} from "./types";

// Firmware guidance utilities
export {
    CHIP_REQUIREMENTS,
    detectFileType,
    generatePreset,
    getChipRequirements,
    validateFile,
    validateFirmwareSet,
} from "./utils/firmwareGuidance";
