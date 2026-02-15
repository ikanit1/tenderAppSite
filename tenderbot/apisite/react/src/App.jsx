import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import './index.css';

const Home = lazy(() => import('./pages/Home'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Admin = lazy(() => import('./pages/Admin'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );
}

// Базовый путь: если открыто по корню (localhost:8001/), basename пустой;
// если по префикту (grgroup.kz/catalog/), используем VITE_BASE_PATH
function getBasename() {
  const envBase = import.meta.env.VITE_BASE_PATH || '';
  if (!envBase) return '';
  return window.location.pathname.startsWith(envBase) ? envBase : '';
}

function App() {
  return (
    <Router basename={getBasename()}>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;
