export interface WebSerialCompatibility {
    supported: boolean;
    status: "supported" | "polyfill" | "unsupported";
    message: string;
    recommendations: string[];
    browserInfo: {
        name: string;
        version: string;
        isSecure: boolean;
    };
}

/**
 * Detects WebSerial API browser compatibility
 * Returns detailed compatibility information including status, messages, and recommendations
 */
export function detectWebSerialCompatibility(): WebSerialCompatibility {
    const browserInfo = getBrowserInfo();

    // Check if running in secure context (HTTPS or localhost)
    if (!browserInfo.isSecure) {
        return {
            supported: false,
            status: "unsupported",
            message: "WebSerial API requires a secure context (HTTPS or localhost)",
            recommendations: ["Use HTTPS instead of HTTP", "Or test on localhost for development"],
            browserInfo,
        };
    }

    // Check for native WebSerial support
    if ("serial" in navigator && typeof (navigator as any).serial?.requestPort === "function") {
        return {
            supported: true,
            status: "supported",
            message: "WebSerial API is natively supported",
            recommendations: [],
            browserInfo,
        };
    }

    // Check if polyfill might work (Chrome-based browsers)
    if (isChromeBased(browserInfo.name)) {
        return {
            supported: true,
            status: "polyfill",
            message: "WebSerial API not native, but polyfill should work",
            recommendations: [
                "Update to the latest Chrome/Edge version for native support",
                "Some advanced features may not work with polyfill",
            ],
            browserInfo,
        };
    }

    // Unsupported browser
    const recommendations = getUnsupportedBrowserRecommendations(browserInfo.name);

    return {
        supported: false,
        status: "unsupported",
        message: `WebSerial API is not supported in ${browserInfo.name}`,
        recommendations,
        browserInfo,
    };
}

/**
 * Get browser information
 */
function getBrowserInfo(): WebSerialCompatibility["browserInfo"] {
    const userAgent = navigator.userAgent;
    let name = "Unknown";
    let version = "Unknown";

    // Detect browser name and version
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
        name = "Chrome";
        const match = userAgent.match(/Chrome\/(\d+)/);
        version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Edg")) {
        name = "Edge";
        const match = userAgent.match(/Edg\/(\d+)/);
        version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Firefox")) {
        name = "Firefox";
        const match = userAgent.match(/Firefox\/(\d+)/);
        version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        name = "Safari";
        const match = userAgent.match(/Safari\/(\d+)/);
        version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Opera")) {
        name = "Opera";
        const match = userAgent.match(/Opera\/(\d+)/);
        version = match ? match[1] : "Unknown";
    }

    return {
        name,
        version,
        isSecure:
            location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1",
    };
}

/**
 * Check if browser is Chrome-based (supports polyfill)
 */
function isChromeBased(browserName: string): boolean {
    return ["Chrome", "Edge", "Opera"].includes(browserName);
}

/**
 * Get recommendations for unsupported browsers
 */
function getUnsupportedBrowserRecommendations(browserName: string): string[] {
    const baseRecommendations = [
        "Use Google Chrome (version 89+) for full WebSerial support",
        "Or use Microsoft Edge (version 89+)",
        "Or use Opera (version 75+)",
    ];

    switch (browserName) {
        case "Firefox":
            return ["Firefox does not support WebSerial API", ...baseRecommendations];
        case "Safari":
            return ["Safari does not support WebSerial API", ...baseRecommendations];
        default:
            return baseRecommendations;
    }
}

/**
 * Test WebSerial functionality
 * Returns true if WebSerial is actually working (not just detected)
 */
export async function testWebSerialFunctionality(): Promise<boolean> {
    try {
        // Import polyfill if needed
        if (!("serial" in navigator)) {
            await import("web-serial-polyfill");
        }

        // Check if serial is now available
        const serial = (navigator as any).serial;
        if (!serial || typeof serial.requestPort !== "function") {
            return false;
        }

        // Try to get existing ports (this shouldn't throw)
        await serial.getPorts();
        return true;
    } catch (error) {
        return false;
    }
}
