import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Layout } from '@/widgets/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SmartSystemsPage } from '@/pages/SmartSystemsPage';
import { DigitalEcosystemPage } from '@/pages/DigitalEcosystemPage';
import { WorkPage } from '@/pages/WorkPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { ToastProvider } from '@/features/toast/ToastProvider';
import { CartProvider } from '@/shared/context/CartContext';
import { OpenAssistantProvider } from '@/shared/context/OpenAssistantContext';

/** Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: 'easeOut' }}>
        <ToastProvider>
          <CartProvider>
            <OpenAssistantProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/contacts" element={<ContactsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/smart-systems" element={<SmartSystemsPage />} />
                  <Route path="/digital-ecosystem" element={<DigitalEcosystemPage />} />
                  <Route path="/work" element={<WorkPage />} />
                  <Route path="/calculator" element={<CalculatorPage />} />
                  <Route path="catalog" element={<CatalogPage />} />
                  <Route path="catalog/*" element={<CatalogPage />} />
                  <Route path="checkout" element={<CatalogPage />} />
                  <Route path="checkout/*" element={<CatalogPage />} />
                </Route>
              </Routes>
            </OpenAssistantProvider>
          </CartProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
