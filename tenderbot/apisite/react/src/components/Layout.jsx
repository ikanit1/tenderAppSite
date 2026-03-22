import { ResetFiltersProvider } from '../context/ResetFiltersContext';

export default function Layout({ children }) {
  return (
    <ResetFiltersProvider>
      {children}
    </ResetFiltersProvider>
  );
}
