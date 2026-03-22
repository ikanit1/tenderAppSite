import { createContext, useContext, useState } from 'react';

const ResetFiltersContext = createContext({
  resetFiltersFn: null,
  setResetFiltersFn: () => {},
});

export function ResetFiltersProvider({ children }) {
  const [resetFiltersFn, setResetFiltersFn] = useState(null);
  return (
    <ResetFiltersContext.Provider value={{ resetFiltersFn, setResetFiltersFn }}>
      {children}
    </ResetFiltersContext.Provider>
  );
}

export function useResetFilters() {
  return useContext(ResetFiltersContext);
}
