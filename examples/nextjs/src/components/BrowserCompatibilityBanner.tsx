"use client";

import { useWebSerialCompatibility } from "esptool-react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function BrowserCompatibilityBanner() {
    const { compatibility, isLoading, isClient } = useWebSerialCompatibility();
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Auto-hide if fully supported and working well
        if (compatibility?.status === "supported" && compatibility.recommendations.length === 0) {
            const timer = setTimeout(() => setIsVisible(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [compatibility]);

    // Don't render on server-side, if loading, if dismissed, or if no compatibility data
    if (!isClient || isLoading || !compatibility || !isVisible) {
        return null;
    }

    // Don't show banner for fully supported browsers with no issues
    if (compatibility.status === "supported" && compatibility.recommendations.length === 0) {
        return null;
    }

    const getStatusColor = () => {
        // Security issues override other status colors
        if (!compatibility.browserInfo.isSecure) {
            return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200";
        }

        switch (compatibility.status) {
            case "supported":
                return "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200";
            case "polyfill":
                return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200";
            case "unsupported":
                return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200";
        }
    };

    const getBadgeVariant = () => {
        switch (compatibility.status) {
            case "supported":
                return "default";
            case "polyfill":
                return "secondary";
            case "unsupported":
                return "destructive";
        }
    };

    return (
        <Alert className={`mb-6 ${getStatusColor()}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-2">
                            <AlertDescription className="font-medium">{compatibility.message}</AlertDescription>
                            <Badge variant={getBadgeVariant()} className="text-xs">
                                {compatibility.browserInfo.name} {compatibility.browserInfo.version}
                            </Badge>
                        </div>

                        {compatibility.recommendations.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-medium mb-1">Recommendations:</p>
                                <ul className="text-sm space-y-1">
                                    {compatibility.recommendations.map((rec: string, index: number) => (
                                        <li key={index} className="flex items-start space-x-1">
                                            <span className="text-xs mt-1">•</span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!compatibility.browserInfo.isSecure && (
                            <div className="mt-2 text-sm">
                                <strong>Security Notice:</strong> WebSerial requires HTTPS in production.
                            </div>
                        )}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsVisible(false)}
                    className="ml-2 h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
                >
                    <X className="w-3 h-3" />
                </Button>
            </div>
        </Alert>
    );
}
