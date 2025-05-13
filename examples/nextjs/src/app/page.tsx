"use client";

import KitchenSink from "@/components/KitchenSink";
import { ESPLoaderProvider } from "esptool-react";
import SparkMD5 from "spark-md5";

export default function HomePage() {
    // Function to calculate MD5 hash as expected by esptool-js
    const calculateMD5Hash = (image: Uint8Array): string => {
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(image.buffer as ArrayBuffer);
        return spark.end();
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
            <ESPLoaderProvider
                calculateMD5Hash={calculateMD5Hash}
                initialBaudrate={115200} // Default programming baudrate
                initialConsoleBaudrate={115200} // Default console baudrate
                initialDebugLogging={false}
                initialRomBaudrate={460800} // Optional: set if different from initialBaudrate
            >
                <KitchenSink />
            </ESPLoaderProvider>
        </main>
    );
}
