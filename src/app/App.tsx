import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Layout } from '@/widgets/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SmartSystemsPage } from '@/pages/SmartSystemsPage';
import { DigitalEcosystemPage } from '@/pages/DigitalEcosystemPage';
import { ToastProvider } from '@/features/toast/ToastProvider';
import { CustomCursor } from '@/shared/ui/CustomCursor/CustomCursor';
import { CartProvider } from '@/shared/context/CartContext';
import { OpenAssistantProvider } from '@/shared/context/OpenAssistantContext';

export function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: 'easeOut' }}>
        <CustomCursor />
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
                </Route>
              </Routes>
            </OpenAssistantProvider>
          </CartProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
