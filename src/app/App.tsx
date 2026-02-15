import { useEffect, useState } from 'react';
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
import { getCatalogUrl } from '@/shared/utils/catalogUrl';

const CATALOG_DEV_URL = 'http://localhost:8001';

function normalizePath(p: string): string {
  return '/' + p.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/') || '/';
}

function CatalogRedirect() {
  const [wouldLoop, setWouldLoop] = useState(false);

  useEffect(() => {
    const url = getCatalogUrl();
    const isRelative = !url.startsWith('http');
    const targetFull = isRelative ? `${window.location.origin}${normalizePath(url)}` : url.replace(/\/+$/, '');
    const currentFull = `${window.location.origin}${normalizePath(window.location.pathname)}`;
    if (targetFull === currentFull) {
      setWouldLoop(true);
      return;
    }
    window.location.href = isRelative ? `${window.location.origin}${normalizePath(url)}` : url;
  }, []);

  if (wouldLoop) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Каталог на этом адресе не запущен.</p>
        <p>
          Запустите <code>npm run dev:apisite</code> и откройте{' '}
          <a href={CATALOG_DEV_URL} rel="noopener noreferrer">
            {CATALOG_DEV_URL}
          </a>
        </p>
      </div>
    );
  }
  return null;
}

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
                  <Route path="catalog" element={<CatalogRedirect />} />
                  <Route path="catalog/*" element={<CatalogRedirect />} />
                </Route>
              </Routes>
            </OpenAssistantProvider>
          </CartProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
