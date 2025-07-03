import React from "react";
import type { ESPLoaderActions, ESPLoaderState } from "../types";

export interface ESPLoaderContextType {
    state: ESPLoaderState;
    actions: ESPLoaderActions;
}

export const ESPLoaderContext = React.createContext<ESPLoaderContextType | undefined>(undefined);
