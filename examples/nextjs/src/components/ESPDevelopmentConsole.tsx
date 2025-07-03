"use client";

import { useEspLoader } from "esptool-react";
import { AlertCircle, Code, Sliders, Terminal } from "lucide-react";
import { useState } from "react";
import { ConsoleMode } from "./ConsoleMode";
import { ProgrammingMode } from "./ProgrammingMode";
import { Settings } from "./Settings";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export default function ESPDevelopmentConsole() {
    const { state } = useEspLoader();
    const [activeTab, setActiveTab] = useState<"programming" | "console" | "settings">("console");

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 dark:from-sky-400 dark:via-sky-300 dark:to-blue-400 bg-clip-text text-transparent">
                    ESP Development Console
                </h1>
                <p className="text-muted-foreground text-lg">
                    Flash firmware, monitor output, and manage your ESP devices
                </p>
            </div>

            {/* Navigation Tabs with Content */}
            <Tabs
                value={activeTab}
                onValueChange={value => setActiveTab(value as "programming" | "console" | "settings")}
            >
                {/* Enhanced Tab Navigation */}
                <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm">
                    <TabsList className="grid w-full grid-cols-3 bg-transparent gap-2 p-1 h-12">
                        <TabsTrigger 
                            value="console" 
                            className="relative text-sm font-semibold h-10 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 hover:bg-secondary/50 flex items-center justify-center gap-2"
                        >
                            <Terminal className="w-4 h-4 hidden sm:inline-block" />
                            Console Mode
                        </TabsTrigger>
                        <TabsTrigger 
                            value="programming" 
                            className="relative text-sm font-semibold h-10 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 hover:bg-secondary/50 flex items-center justify-center gap-2"
                        >
                            <Code className="w-4 h-4 hidden sm:inline-block" />
                            Programming Mode
                        </TabsTrigger>
                        <TabsTrigger 
                            value="settings" 
                            className="relative text-sm font-semibold h-10 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 hover:bg-secondary/50 flex items-center justify-center gap-2"
                        >
                            <Sliders className="w-4 h-4 hidden sm:inline-block" />
                            Settings
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="programming" className="mt-6">
                    <ProgrammingMode />
                </TabsContent>
                <TabsContent value="console" className="mt-6">
                    <ConsoleMode />
                </TabsContent>
                <TabsContent value="settings" className="mt-6">
                    <Settings />
                </TabsContent>
            </Tabs>

            {/* Error Display */}
            {state.error && (
                <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="font-medium">{state.error.toString()}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
