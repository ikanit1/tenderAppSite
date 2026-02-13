import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface OpenAssistantContextType {
  openAssistant: () => void;
  setOpenAssistant: (fn: () => void) => void;
}

const OpenAssistantContext = createContext<OpenAssistantContextType | null>(null);

export function OpenAssistantProvider({ children }: { children: ReactNode }) {
  const [openFn, setOpenFn] = useState<(() => void) | null>(null);

  const openAssistant = useCallback(() => {
    if (openFn) {
      openFn();
    }
  }, [openFn]);

  const setOpenAssistant = useCallback((fn: () => void) => {
    setOpenFn(() => fn);
  }, []);

  return (
    <OpenAssistantContext.Provider value={{ openAssistant, setOpenAssistant }}>
      {children}
    </OpenAssistantContext.Provider>
  );
}

export function useOpenAssistant() {
  const context = useContext(OpenAssistantContext);
  if (!context) {
    throw new Error('useOpenAssistant must be used within OpenAssistantProvider');
  }
  return context;
}
