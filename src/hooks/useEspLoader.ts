import { useContext } from 'react';
import { ESPLoaderContext, ESPLoaderContextType } from '../context/ESPLoaderContext';

/**
 * Hook to access the ESP Loader context
 * @returns The ESP Loader context (state and actions)
 * @throws Error if used outside of ESPLoaderProvider
 */
export function useEspLoader(): ESPLoaderContextType {
  const context = useContext(ESPLoaderContext);
  
  if (context === undefined) {
    throw new Error('useEspLoader must be used within an ESPLoaderProvider');
  }
  
  return context;
} 