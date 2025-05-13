import React from "react";
import type { ESPLoaderState, ESPLoaderActions } from "../types";

export interface ESPLoaderContextType {
    state: ESPLoaderState;
    actions: ESPLoaderActions;
}

export const ESPLoaderContext = React.createContext<ESPLoaderContextType | undefined>(undefined);
