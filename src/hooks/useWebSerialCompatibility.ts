import { useEffect, useState } from "react";
import {
    detectWebSerialCompatibility,
    testWebSerialFunctionality,
    type WebSerialCompatibility,
} from "../utils/browserCompatibility";

export interface UseWebSerialCompatibilityResult {
    compatibility: WebSerialCompatibility | null;
    isLoading: boolean;
    isClient: boolean;
}

/**
 * Hook for detecting WebSerial browser compatibility
 * Handles client-side detection and provides reactive state
 */
export function useWebSerialCompatibility(): UseWebSerialCompatibilityResult {
    const [compatibility, setCompatibility] = useState<WebSerialCompatibility | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    const detectCompatibility = async () => {
        setIsLoading(true);
        try {
            const compat = detectWebSerialCompatibility();

            // If it claims to be supported, test actual functionality
            if (compat.supported) {
                const actuallyWorks = await testWebSerialFunctionality();
                if (!actuallyWorks && compat.status === "supported") {
                    // Downgrade to polyfill status if native doesn't actually work
                    setCompatibility({
                        ...compat,
                        status: "polyfill",
                        message: "WebSerial API detected but may need polyfill",
                        recommendations: ["Try refreshing the page", ...compat.recommendations],
                    });
                } else {
                    setCompatibility(compat);
                }
            } else {
                setCompatibility(compat);
            }
        } catch (error) {
            // Fallback compatibility info
            setCompatibility({
                supported: false,
                status: "unsupported",
                message: "Unable to detect WebSerial compatibility",
                recommendations: ["Try refreshing the page", "Use a supported browser like Chrome or Edge"],
                browserInfo: {
                    name: "Unknown",
                    version: "Unknown",
                    isSecure: false,
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setIsClient(true);
        detectCompatibility();
    }, []);

    return {
        compatibility,
        isLoading,
        isClient,
    };
}
