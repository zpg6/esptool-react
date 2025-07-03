import type {
    ChipFirmwareRequirements,
    ESPFile,
    FileValidationResult,
    FirmwareFileType,
    FirmwareValidationSummary,
} from "../types";

// Chip-specific firmware requirements based on ESP documentation
export const CHIP_REQUIREMENTS: Record<string, ChipFirmwareRequirements> = {
    ESP8266: {
        chipName: "ESP8266",
        bootloaderAddress: 0x0,
        requiredFiles: {
            bootloader: {
                type: "bootloader",
                isRequired: true,
                description: "Second-stage bootloader for ESP8266",
                recommendedAddress: 0x0,
                validAddresses: [0x0],
                chipSpecific: true,
            },
            partition_table: {
                type: "partition_table",
                isRequired: true,
                description: "Partition table defining flash memory layout",
                recommendedAddress: 0x8000,
                validAddresses: [0x8000],
            },
            app: {
                type: "app",
                isRequired: true,
                description: "Main application firmware",
                recommendedAddress: 0x10000,
                validAddresses: [0x10000],
            },
            nvs: {
                type: "nvs",
                isRequired: false,
                description: "Non-volatile storage partition",
                recommendedAddress: 0x9000,
            },
            phy_init: {
                type: "phy_init",
                isRequired: false,
                description: "PHY initialization data",
                recommendedAddress: 0xf000,
            },
        },
        commonAddresses: {
            bootloader: 0x0,
            partition_table: 0x8000,
            nvs: 0x9000,
            phy_init: 0xf000,
            app: 0x10000,
        },
    },
    ESP32: {
        chipName: "ESP32",
        bootloaderAddress: 0x1000,
        requiredFiles: {
            bootloader: {
                type: "bootloader",
                isRequired: true,
                description: "Second-stage bootloader for ESP32",
                recommendedAddress: 0x1000,
                validAddresses: [0x1000],
                chipSpecific: true,
            },
            partition_table: {
                type: "partition_table",
                isRequired: true,
                description: "Partition table defining flash memory layout",
                recommendedAddress: 0x8000,
                validAddresses: [0x8000],
            },
            app: {
                type: "app",
                isRequired: true,
                description: "Main application firmware",
                recommendedAddress: 0x10000,
                validAddresses: [0x10000],
            },
            nvs: {
                type: "nvs",
                isRequired: false,
                description: "Non-volatile storage partition",
                recommendedAddress: 0x9000,
            },
            phy_init: {
                type: "phy_init",
                isRequired: false,
                description: "PHY initialization data",
                recommendedAddress: 0xf000,
            },
        },
        commonAddresses: {
            bootloader: 0x1000,
            partition_table: 0x8000,
            nvs: 0x9000,
            phy_init: 0xf000,
            app: 0x10000,
        },
    },
    "ESP32-S2": {
        chipName: "ESP32-S2",
        bootloaderAddress: 0x0,
        requiredFiles: {
            bootloader: {
                type: "bootloader",
                isRequired: true,
                description: "Second-stage bootloader for ESP32-S2",
                recommendedAddress: 0x0,
                validAddresses: [0x0],
                chipSpecific: true,
            },
            partition_table: {
                type: "partition_table",
                isRequired: true,
                description: "Partition table defining flash memory layout",
                recommendedAddress: 0x8000,
                validAddresses: [0x8000],
            },
            app: {
                type: "app",
                isRequired: true,
                description: "Main application firmware",
                recommendedAddress: 0x10000,
                validAddresses: [0x10000],
            },
        },
        commonAddresses: {
            bootloader: 0x0,
            partition_table: 0x8000,
            app: 0x10000,
        },
    },
    "ESP32-S3": {
        chipName: "ESP32-S3",
        bootloaderAddress: 0x0,
        requiredFiles: {
            bootloader: {
                type: "bootloader",
                isRequired: true,
                description: "Second-stage bootloader for ESP32-S3",
                recommendedAddress: 0x0,
                validAddresses: [0x0],
                chipSpecific: true,
            },
            partition_table: {
                type: "partition_table",
                isRequired: true,
                description: "Partition table defining flash memory layout",
                recommendedAddress: 0x8000,
                validAddresses: [0x8000],
            },
            app: {
                type: "app",
                isRequired: true,
                description: "Main application firmware",
                recommendedAddress: 0x10000,
                validAddresses: [0x10000],
            },
        },
        commonAddresses: {
            bootloader: 0x0,
            partition_table: 0x8000,
            app: 0x10000,
        },
    },
    "ESP32-C3": {
        chipName: "ESP32-C3",
        bootloaderAddress: 0x0,
        requiredFiles: {
            bootloader: {
                type: "bootloader",
                isRequired: true,
                description: "Second-stage bootloader for ESP32-C3",
                recommendedAddress: 0x0,
                validAddresses: [0x0],
                chipSpecific: true,
            },
            partition_table: {
                type: "partition_table",
                isRequired: true,
                description: "Partition table defining flash memory layout",
                recommendedAddress: 0x8000,
                validAddresses: [0x8000],
            },
            app: {
                type: "app",
                isRequired: true,
                description: "Main application firmware",
                recommendedAddress: 0x10000,
                validAddresses: [0x10000],
            },
        },
        commonAddresses: {
            bootloader: 0x0,
            partition_table: 0x8000,
            app: 0x10000,
        },
    },
};

// Detect firmware file type based on filename and address
export function detectFileType(fileName: string, address: number): FirmwareFileType {
    const name = fileName.toLowerCase();

    // Check by filename patterns
    if (name.includes("bootloader")) return "bootloader";
    if (name.includes("partition") && (name.includes("table") || name.includes("partitions"))) return "partition_table";
    if (name.includes("ota") && name.includes("data")) return "ota_data";
    if (name.includes("nvs")) return "nvs";
    if (name.includes("phy") && name.includes("init")) return "phy_init";

    // Check by common addresses
    switch (address) {
        case 0x0:
        case 0x1000:
            return "bootloader";
        case 0x8000:
            return "partition_table";
        case 0x9000:
            return "nvs";
        case 0xd000:
            return "ota_data";
        case 0xf000:
            return "phy_init";
        case 0x10000:
            return "app";
        default:
            // Check if it's likely an app partition (aligned to 64KB)
            if (address >= 0x10000 && address % 0x10000 === 0) {
                return "app";
            }
            return "unknown";
    }
}

// Validate a single file
export function validateFile(file: ESPFile, chipType: string | null): FileValidationResult {
    const result: FileValidationResult = {
        isValid: true,
        warnings: [],
        errors: [],
        suggestions: [],
    };

    const detectedType = detectFileType(file.fileName || "", file.address);
    result.detectedType = detectedType;

    if (!chipType) {
        result.warnings.push("Connect to device to get chip-specific validation");
        return result;
    }

    const chipRequirements = CHIP_REQUIREMENTS[chipType];
    if (!chipRequirements) {
        result.warnings.push(`Unknown chip type: ${chipType}`);
        return result;
    }

    const fileInfo = chipRequirements.requiredFiles[detectedType];

    if (fileInfo) {
        // Check if address is valid for this file type
        if (fileInfo.validAddresses && !fileInfo.validAddresses.includes(file.address)) {
            result.errors.push(
                `${detectedType} should be at address ${fileInfo.validAddresses.map(a => `0x${a.toString(16)}`).join(" or ")}, but is at 0x${file.address.toString(16)}`
            );
            result.isValid = false;
        }

        // Suggest recommended address if different
        if (fileInfo.recommendedAddress && fileInfo.recommendedAddress !== file.address) {
            result.suggestions.push(
                `Consider using recommended address 0x${fileInfo.recommendedAddress.toString(16)} for ${detectedType}`
            );
        }
    } else if (detectedType === "unknown") {
        result.warnings.push("Could not detect file type - please verify this is the correct file");
    }

    // Check alignment for app partitions
    if (detectedType === "app" && file.address % 0x10000 !== 0) {
        result.errors.push("App partitions must be aligned to 64KB (0x10000) boundaries");
        result.isValid = false;
    }

    return result;
}

// Validate entire firmware set
export function validateFirmwareSet(files: ESPFile[], chipType: string | null): FirmwareValidationSummary {
    const summary: FirmwareValidationSummary = {
        isComplete: false,
        missingRequired: [],
        addressConflicts: [],
        warnings: [],
        suggestions: [],
    };

    if (!chipType) {
        summary.warnings.push("Connect to device for comprehensive validation");
        return summary;
    }

    const chipRequirements = CHIP_REQUIREMENTS[chipType];
    if (!chipRequirements) {
        summary.warnings.push(`Unknown chip type: ${chipType}`);
        return summary;
    }

    // Check for required files
    const presentTypes = new Set<FirmwareFileType>();
    const addressMap = new Map<number, string[]>();

    files.forEach(file => {
        const detectedType = detectFileType(file.fileName || "", file.address);
        presentTypes.add(detectedType);

        // Track address conflicts
        if (!addressMap.has(file.address)) {
            addressMap.set(file.address, []);
        }
        addressMap.get(file.address)!.push(file.fileName || `file_0x${file.address.toString(16)}`);
    });

    // Find missing required files
    Object.entries(chipRequirements.requiredFiles).forEach(([type, info]) => {
        if (info.isRequired && !presentTypes.has(type as FirmwareFileType)) {
            summary.missingRequired.push(type as FirmwareFileType);
        }
    });

    // Find address conflicts
    addressMap.forEach((fileNames, address) => {
        if (fileNames.length > 1) {
            for (let i = 0; i < fileNames.length - 1; i++) {
                for (let j = i + 1; j < fileNames.length; j++) {
                    summary.addressConflicts.push({
                        file1: fileNames[i],
                        file2: fileNames[j],
                        address,
                    });
                }
            }
        }
    });

    // Generate suggestions
    if (summary.missingRequired.length === 0 && summary.addressConflicts.length === 0) {
        summary.isComplete = true;
    } else {
        if (summary.missingRequired.length > 0) {
            summary.suggestions.push(
                `Missing required files: ${summary.missingRequired.join(", ")}. ` +
                    `For ${chipType}, you typically need: bootloader (0x${chipRequirements.bootloaderAddress.toString(16)}), ` +
                    `partition table (0x8000), and app (0x10000).`
            );
        }
    }

    return summary;
}

// Get file requirements for a chip
export function getChipRequirements(chipType: string | null): ChipFirmwareRequirements | null {
    if (!chipType || !CHIP_REQUIREMENTS[chipType]) {
        return null;
    }
    return CHIP_REQUIREMENTS[chipType];
}

// Generate quick preset for common configurations
export function generatePreset(
    chipType: string,
    presetType: "basic" | "ota"
): Array<{ type: FirmwareFileType; address: number; description: string }> {
    const chipRequirements = CHIP_REQUIREMENTS[chipType];
    if (!chipRequirements) {
        return [];
    }

    const preset = [
        {
            type: "bootloader" as FirmwareFileType,
            address: chipRequirements.bootloaderAddress,
            description: "Second-stage bootloader",
        },
        {
            type: "partition_table" as FirmwareFileType,
            address: chipRequirements.commonAddresses.partition_table || 0x8000,
            description: "Partition table",
        },
        {
            type: "app" as FirmwareFileType,
            address: chipRequirements.commonAddresses.app || 0x10000,
            description: "Main application",
        },
    ];

    if (presetType === "ota") {
        preset.push({
            type: "ota_data" as FirmwareFileType,
            address: 0xd000,
            description: "OTA update data",
        });
    }

    return preset;
}
