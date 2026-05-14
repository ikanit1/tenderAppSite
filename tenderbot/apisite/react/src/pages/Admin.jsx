import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { withBaseUrl } from '../utils/baseUrl';

const MotionLink = motion(Link);
import Background from '../components/Background';

const TABS = [
  { id: 'dashboard', label: 'Дашборд', icon: '📊' },
  { id: 'prices', label: 'Цены и скидки', icon: '💰' },
  { id: 'visibility', label: 'Видимость', icon: '👁️' },
  { id: 'parser', label: 'Парсер изображений', icon: '🖼️' },
  { id: 'portal', label: 'Портал', icon: '🔍' },
  { id: 'enrichment', label: 'Обогащение', icon: '✨' },
];

const sectionVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delay: 0.05 } } };
const listContainerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const listItemVariants = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } };

// Базовый URL API: бэкенд (FastAPI). В dev при proxy оставить пусто; если 404 — задать VITE_API_ORIGIN=http://localhost:8001
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ORIGIN) || '';

function api(path, options = {}) {
  if (API_BASE) {
    const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/api/${path}`;
    return fetch(url, options).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.detail || r.statusText); });
      return r.json().catch(() => ({}));
    });
  }

  const url = path.startsWith('/') ? withBaseUrl(path) : withBaseUrl(`/api/${path}`);
  return fetch(url, options).then(r => {
    if (!r.ok) return r.json().then(d => { throw new Error(d.detail || r.statusText); });
    return r.json().catch(() => ({}));
  });
}

function formatDateTime(value) {
  if (value == null || value === '') return '—';
  let date;

  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value * 1000);
  } else if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return '—';
    const n = Number(s);
    if (Number.isFinite(n)) date = new Date(n * 1000);
    else date = new Date(s);
  } else {
    return '—';
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <motion.div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <p className="admin-modal-message">{message}</p>
        <div className="admin-modal-actions">
          <motion.button
            type="button"
            className="btn-action btn-secondary"
            onClick={onCancel}
            autoFocus
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Отмена
          </motion.button>
          <motion.button
            type="button"
            className="btn-action btn-secondary danger"
            onClick={onConfirm}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Подтвердить
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function colorizeLogLine(line) {
  if (/error|ошибка|fail|failed|exception/i.test(line)) return '#fca5a5';
  if (/warn|предупреждение|warning/i.test(line)) return '#fde68a';
  if (/\[ok\]|success|успешн|готово|создан|saved|done|found/i.test(line)) return '#86efac';
  return null;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, withPrice: 0, withoutPrice: 0 });

  // Prices state
  const [pricesConfig, setPricesConfig] = useState(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [searchModel, setSearchModel] = useState('');
  const [price, setPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [newModelDiscount, setNewModelDiscount] = useState({ model: '', discount: '' });
  const [newBrandDiscount, setNewBrandDiscount] = useState({ brand: '', discount: '' });
  const [newCustomPrice, setNewCustomPrice] = useState({ model: '', price: '' });
  const [priceMessage, setPriceMessage] = useState(null);

  // Parser state
  const [parserStatus, setParserStatus] = useState(null);
  const [parserStats, setParserStats] = useState(null);
  const [parserAction, setParserAction] = useState(null);
  const [parserMaxPages, setParserMaxPages] = useState(5);

  // Portal parser state
  const [portalParserStatus, setPortalParserStatus] = useState(null);
  const [portalParserLogs, setPortalParserLogs] = useState([]);
  const portalLogPreRef = useRef(null);
  const [logScrollPaused, setLogScrollPaused] = useState(false);

  // Portal state
  const [portalMismatch, setPortalMismatch] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalSearch, setPortalSearch] = useState('');

  // Enrichment state
  const [enrichmentStatus, setEnrichmentStatus] = useState(null);
  const [enrichmentLogs, setEnrichmentLogs] = useState([]);
  const [enrichmentAction, setEnrichmentAction] = useState(null);
  const [enrichmentLogPaused, setEnrichmentLogPaused] = useState(false);
  const enrichLogRef = useRef(null);

  // Visibility state
  const [visibilityConfig, setVisibilityConfig] = useState(null);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [allBrandsList, setAllBrandsList] = useState([]);
  const [newHiddenBrand, setNewHiddenBrand] = useState('');
  const [newHiddenModel, setNewHiddenModel] = useState('');

  // Health (dashboard last update)
  const [healthData, setHealthData] = useState(null);
  // Brand filter for "Товары без цены"
  const [brandFilter, setBrandFilter] = useState('');
  const [withoutPricePage, setWithoutPricePage] = useState(1);
  const NOPRICE_PAGE_SIZE = 50;
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  const showConfirm = useCallback((message, onConfirm) => {
    setConfirmModal({ message, onConfirm });
  }, []);
  const closeConfirm = useCallback(() => setConfirmModal(null), []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/products');
      const list = data.products || [];
      setProducts(list);
      const withPrice = list.filter(p => p.final_price != null && p.final_price > 0).length;
      setStats({ total: list.length, withPrice, withoutPrice: list.length - withPrice });
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const data = await api('/api/admin/prices');
      setPricesConfig(data);
      setGlobalDiscount(data.global_discount != null ? String(data.global_discount) : '');
    } catch (err) {
      setPriceMessage({ type: 'error', text: err.message });
    } finally {
      setPricesLoading(false);
    }
  }, []);

  const loadParserStatus = useCallback(async () => {
    try {
      const data = await api('/api/parse-images/status');
      setParserStatus(data);
    } catch (err) {
      setParserStatus({ error: err.message });
    }
  }, []);

  const loadParserStats = useCallback(async () => {
    try {
      const data = await api('/api/parse-images/stats');
      setParserStats(data);
    } catch (err) {
      setParserStats({ error: err.message });
    }
  }, []);

  const loadPortalMismatch = useCallback(async () => {
    if (!authenticated) return;
    setPortalLoading(true);
    try {
      const data = await api('/api/admin/portal-mismatch');
      setPortalMismatch(data);
    } catch (err) {
      setPortalMismatch({ error: err.message });
    } finally {
      setPortalLoading(false);
    }
  }, [authenticated]);

  const loadPortalParserStatus = useCallback(async () => {
    try {
      const data = await api('/api/portal-parser/status');
      setPortalParserStatus(data);
      return data;
    } catch (err) {
      setPortalParserStatus({ running: false, error: err.message });
      return null;
    }
  }, []);

  const LOGS_MAX_LINES = 150;
  const loadPortalParserLogs = useCallback(async () => {
    try {
      const data = await api(`/api/portal-parser/logs?limit=${LOGS_MAX_LINES}`);
      setPortalParserLogs((data.lines || []).slice(0, LOGS_MAX_LINES));
    } catch {
      setPortalParserLogs([]);
    }
  }, []);

  const loadEnrichmentStatus = useCallback(async () => {
    try {
      const data = await api('/api/enrichment/status');
      setEnrichmentStatus(data);
      return data;
    } catch (err) {
      setEnrichmentStatus({ running: false, error: err.message });
      return null;
    }
  }, []);

  const loadEnrichmentLogs = useCallback(async () => {
    try {
      const data = await api(`/api/enrichment/logs?limit=${150}`);
      setEnrichmentLogs((data.lines || []).slice(0, 150));
    } catch {
      setEnrichmentLogs([]);
    }
  }, []);

  const loadVisibility = useCallback(async () => {
    setVisibilityLoading(true);
    try {
      const data = await api('/api/admin/visibility');
      setVisibilityConfig(data);
    } catch (err) {
      setPriceMessage({ type: 'error', text: err.message });
    } finally {
      setVisibilityLoading(false);
    }
    try {
      const data = await api('/products?include_hidden=1&limit=1');
      setAllBrandsList(data.brands || []);
    } catch {
      setAllBrandsList([]);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const data = await api('/api/admin/check');
      setAuthenticated(data.authenticated || false);
    } catch (err) {
      setAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login, password }),
      });
      setAuthenticated(true);
      setLogin('');
      setPassword('');
    } catch (err) {
      setLoginError(err.message || 'Неверный логин или пароль');
    }
  }, [login, password]);

  const handleLogout = useCallback(async () => {
    try {
      await api('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setAuthenticated(false);
    } catch (err) {
      console.error('Ошибка выхода:', err);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'dashboard' || tab === 'prices') loadProducts();
  }, [tab, loadProducts, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'dashboard') api('/health').then(setHealthData).catch(() => setHealthData(null));
  }, [tab, authenticated]);
  useEffect(() => {
    if (!authenticated || tab !== 'dashboard') return;
    const interval = setInterval(() => {
      api('/health').then(setHealthData).catch(() => setHealthData(null));
      loadProducts();
    }, 60000);
    return () => clearInterval(interval);
  }, [authenticated, tab, loadProducts]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'prices') loadPrices();
  }, [tab, loadPrices, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'parser') { loadParserStatus(); loadParserStats(); loadPortalParserStatus(); loadPortalParserLogs(); }
  }, [tab, loadParserStatus, loadParserStats, loadPortalParserStatus, loadPortalParserLogs, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'portal') loadPortalMismatch();
  }, [tab, loadPortalMismatch, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'enrichment') { loadEnrichmentStatus(); loadEnrichmentLogs(); }
  }, [tab, loadEnrichmentStatus, loadEnrichmentLogs, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'visibility') loadVisibility();
  }, [tab, loadVisibility, authenticated]);

  useEffect(() => {
    setWithoutPricePage(1);
  }, [brandFilter]);

  // Polling статуса и логов парсера портала, когда он запущен и открыта вкладка «Парсер»
  useEffect(() => {
    if (!authenticated || tab !== 'parser' || !portalParserStatus?.running) return;
    let ignore = false;
    const interval = setInterval(async () => {
      if (ignore) return;
      const status = await loadPortalParserStatus();
      if (ignore || !status?.running) return;
      loadPortalParserLogs();
    }, 2000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [authenticated, tab, portalParserStatus?.running, loadPortalParserStatus, loadPortalParserLogs]);

  useEffect(() => {
    if (!authenticated || logScrollPaused) return;
    if (portalLogPreRef.current && portalParserLogs.length)
      portalLogPreRef.current.scrollTop = portalLogPreRef.current.scrollHeight;
  }, [portalParserLogs, authenticated, logScrollPaused]);

  // Polling обогащения
  useEffect(() => {
    if (!authenticated || tab !== 'enrichment' || !enrichmentStatus?.running) return;
    let ignore = false;
    const interval = setInterval(async () => {
      if (ignore) return;
      const status = await loadEnrichmentStatus();
      if (ignore || !status?.running) return;
      loadEnrichmentLogs();
    }, 2000);
    return () => { ignore = true; clearInterval(interval); };
  }, [authenticated, tab, enrichmentStatus?.running, loadEnrichmentStatus, loadEnrichmentLogs]);

  useEffect(() => {
    if (!authenticated || enrichmentLogPaused) return;
    if (enrichLogRef.current && enrichmentLogs.length)
      enrichLogRef.current.scrollTop = enrichLogRef.current.scrollHeight;
  }, [enrichmentLogs, authenticated, enrichmentLogPaused]);

  const handleTabChange = (newTab) => {
    if (newTab === tab) return;
    setTab(newTab);
  };

  const priceMessageTimerRef = useRef(null);
  const showPriceMsg = useCallback((type, text) => {
    if (priceMessageTimerRef.current) clearTimeout(priceMessageTimerRef.current);
    setPriceMessage({ type, text });
    priceMessageTimerRef.current = setTimeout(() => {
      setPriceMessage(null);
      priceMessageTimerRef.current = null;
    }, 4000);
  }, []);
  useEffect(() => () => {
    if (priceMessageTimerRef.current) clearTimeout(priceMessageTimerRef.current);
  }, []);

  const handleSearch = async () => {
    if (!searchModel.trim()) { showPriceMsg('error', 'Введите модель'); return; }
    try {
      const product = await api(`/products/${encodeURIComponent(searchModel)}`);
      setSelectedProduct(product);
      setPrice(product.final_price != null ? String(product.final_price) : '');
    } catch {
      showPriceMsg('error', 'Товар не найден');
      setSelectedProduct(null);
    }
  };

  const handleUpdatePrice = async () => {
    if (!selectedProduct || !price.trim()) { showPriceMsg('error', 'Введите цену'); return; }
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) { showPriceMsg('error', 'Некорректная цена'); return; }
    try {
      await api('/api/admin/prices/custom-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedProduct.model, price: priceValue }),
      });
      showPriceMsg('success', 'Кастомная цена установлена');
      setSelectedProduct({ ...selectedProduct, final_price: priceValue });
      loadProducts();
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const handleDeletePrice = () => {
    if (!selectedProduct) return;
    showConfirm('Удалить кастомную цену для этого товара?', async () => {
      closeConfirm();
      try {
        await api(`/api/admin/prices/custom-price/${encodeURIComponent(selectedProduct.model)}`, { method: 'DELETE' });
        showPriceMsg('success', 'Цена удалена');
        setSelectedProduct({ ...selectedProduct, final_price: null });
        loadProducts();
        loadPrices();
      } catch (err) {
        showPriceMsg('error', err.message);
      }
    });
  };

  const saveGlobalDiscount = async () => {
    const v = parseFloat(globalDiscount);
    if (isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/global-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount: v }),
      });
      showPriceMsg('success', `Глобальная скидка: ${v}%`);
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const addModelDiscount = async () => {
    const model = (newModelDiscount.model || '').trim();
    const v = parseFloat(newModelDiscount.discount);
    if (!model || isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Модель и скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/model-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, discount: v }),
      });
      showPriceMsg('success', `Скидка для ${model}: ${v}%`);
      setNewModelDiscount({ model: '', discount: '' });
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const removeModelDiscount = async (model) => {
    try {
      await api(`/api/admin/prices/model-discount/${encodeURIComponent(model)}`, { method: 'DELETE' });
      showPriceMsg('success', `Скидка для ${model} удалена`);
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const addBrandDiscount = async () => {
    const brand = (newBrandDiscount.brand || '').trim();
    const v = parseFloat(newBrandDiscount.discount);
    if (!brand || isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Бренд и скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/brand-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, discount: v }),
      });
      showPriceMsg('success', `Скидка для бренда ${brand}: ${v}%`);
      setNewBrandDiscount({ brand: '', discount: '' });
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const removeBrandDiscount = async (brand) => {
    try {
      await api(`/api/admin/prices/brand-discount/${encodeURIComponent(brand)}`, { method: 'DELETE' });
      showPriceMsg('success', `Скидка для бренда ${brand} удалена`);
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const addCustomPrice = async () => {
    const model = (newCustomPrice.model || '').trim();
    const v = parseFloat(newCustomPrice.price);
    if (!model || isNaN(v) || v < 0) { showPriceMsg('error', 'Модель и цена ≥ 0'); return; }
    try {
      await api('/api/admin/prices/custom-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, price: v }),
      });
      showPriceMsg('success', `Кастомная цена для ${model}: ${v} ₸`);
      setNewCustomPrice({ model: '', price: '' });
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const removeCustomPrice = async (model) => {
    try {
      await api(`/api/admin/prices/custom-price/${encodeURIComponent(model)}`, { method: 'DELETE' });
      showPriceMsg('success', `Кастомная цена для ${model} удалена`);
      loadPrices();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const addHiddenBrand = async () => {
    const brand = (newHiddenBrand || '').trim();
    if (!brand) { showPriceMsg('error', 'Выберите бренд'); return; }
    try {
      await api('/api/admin/visibility/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      });
      showPriceMsg('success', `Бренд ${brand} скрыт из каталога`);
      setNewHiddenBrand('');
      loadVisibility();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const removeHiddenBrand = async (brand) => {
    try {
      await api(`/api/admin/visibility/brand/${encodeURIComponent(brand)}`, { method: 'DELETE' });
      showPriceMsg('success', `Бренд ${brand} снова виден в каталоге`);
      loadVisibility();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const addHiddenModel = async () => {
    const model = (newHiddenModel || '').trim();
    if (!model) { showPriceMsg('error', 'Введите модель'); return; }
    try {
      await api('/api/admin/visibility/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      showPriceMsg('success', `Модель ${model} скрыта из каталога`);
      setNewHiddenModel('');
      loadVisibility();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const removeHiddenModel = async (model) => {
    try {
      await api(`/api/admin/visibility/model/${encodeURIComponent(model)}`, { method: 'DELETE' });
      showPriceMsg('success', `Модель ${model} снова видна в каталоге`);
      loadVisibility();
    } catch (err) {
      showPriceMsg('error', err.message);
    }
  };

  const startParser = async () => {
    setParserAction('start');
    try {
      await api(`/api/parse-images/start?max_pages=${parserMaxPages}`, { method: 'POST' });
      showPriceMsg('success', 'Парсинг изображений запущен');
      loadParserStatus();
      loadParserStats();
    } catch (err) {
      showPriceMsg('error', err.message);
    } finally {
      setParserAction(null);
    }
  };

  const startPortalParser = async () => {
    setParserAction('portal');
    try {
      // end_page=0 означает автоопределение количества страниц из пагинации сайта
      await api('/api/portal-parser/start?start_page=1&end_page=0', { method: 'POST' });
      showPriceMsg('success', 'Парсер портала запущен (авто-определение страниц)');
      loadPortalParserStatus();
      loadPortalParserLogs();
      setTimeout(() => {
        loadParserStatus();
        loadParserStats();
      }, 2000);
    } catch (err) {
      showPriceMsg('error', err.message);
    } finally {
      setParserAction(null);
    }
  };

  const stopPortalParser = () => {
    if (!portalParserStatus?.running) return;
    showConfirm('Остановить парсер портала?', async () => {
      closeConfirm();
      setParserAction('stop');
      try {
        await api('/api/portal-parser/stop', { method: 'POST' });
        showPriceMsg('success', 'Парсер остановлен');
        loadPortalParserStatus();
        loadPortalParserLogs();
      } catch (err) {
        showPriceMsg('error', err.message);
      } finally {
        setParserAction(null);
      }
    });
  };

  const startPortalParserMissing = async () => {
    if (!portalMismatch?.missing_count) return;
    setParserAction('missing');
    try {
      const res = await api('/api/portal-parser/start-missing', { method: 'POST' });
      showPriceMsg('success', res.message || `Парсер запущен для ${res.count || 0} папок`);
      loadPortalParserStatus();
      loadPortalParserLogs();
      loadPortalMismatch();
    } catch (err) {
      showPriceMsg('error', err.message);
    } finally {
      setParserAction(null);
    }
  };

  const startEnrichment = async (force = false) => {
    setEnrichmentAction('start');
    try {
      await api(`/api/enrichment/start${force ? '?force=true' : ''}`, { method: 'POST' });
      showPriceMsg('success', 'Обогащение запущено');
      loadEnrichmentStatus();
      loadEnrichmentLogs();
    } catch (err) {
      showPriceMsg('error', err.message);
    } finally {
      setEnrichmentAction(null);
    }
  };

  const stopEnrichment = () => {
    if (!enrichmentStatus?.running) return;
    showConfirm('Остановить обогащение?', async () => {
      closeConfirm();
      setEnrichmentAction('stop');
      try {
        await api('/api/enrichment/stop', { method: 'POST' });
        showPriceMsg('success', 'Обогащение остановлено');
        loadEnrichmentStatus();
        loadEnrichmentLogs();
      } catch (err) {
        showPriceMsg('error', err.message);
      } finally {
        setEnrichmentAction(null);
      }
    });
  };

  const clearParserCache = () => {
    showConfirm('Очистить кэш парсера? При следующем запуске парсер начнёт с начала.', async () => {
      closeConfirm();
      setParserAction('clear');
      try {
        const res = await api('/api/parse-images/clear-cache', { method: 'POST' });
        showPriceMsg('success', res.message || 'Кэш очищен');
        loadParserStatus();
        loadParserStats();
      } catch (err) {
        showPriceMsg('error', err.message);
      } finally {
        setParserAction(null);
      }
    });
  };

  const modelDiscounts = pricesConfig?.model_discounts || {};
  const brandDiscounts = pricesConfig?.brand_discounts || {};
  const customPrices = pricesConfig?.custom_prices || {};
  const hiddenBrands = visibilityConfig?.hidden_brands || [];
  const hiddenModels = visibilityConfig?.hidden_models || [];
  const availableBrands = allBrandsList.filter(
    b => !hiddenBrands.some(hb => hb.toLowerCase() === b.toLowerCase())
  );
  const withoutPriceAll = products.filter(p => !p.final_price || p.final_price <= 0);
  const withoutPriceFiltered = brandFilter ? withoutPriceAll.filter(p => p.brand === brandFilter) : withoutPriceAll;
  const withoutPrice = withoutPriceFiltered.slice(0, withoutPricePage * NOPRICE_PAGE_SIZE);
  const hasMoreNoprice = withoutPriceFiltered.length > withoutPrice.length;
  const withoutPriceBrands = [...new Set(withoutPriceAll.map(p => p.brand).filter(Boolean))].sort();
  const portalMissingFiltered = (() => {
    const all = portalMismatch?.missing || [];
    if (!portalSearch.trim()) return all;
    const q = portalSearch.toLowerCase();
    return all.filter(row =>
      (row.model || '').toLowerCase().includes(q) ||
      (row.name || '').toLowerCase().includes(q) ||
      (row.brand || '').toLowerCase().includes(q)
    );
  })();

  if (checkingAuth) {
    return (
      <>
        <Background />
        <div className="admin-container">
          <div className="container">
            <div className="loading">
              <div className="spinner"></div>
              <p>Проверка авторизации...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <Background />
        <div className="admin-container">
          <div className="container">
            <h1 className="admin-title">Вход в админ-панель</h1>
            <motion.form
              className="admin-login-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleLogin}
            >
              {loginError && (
                <motion.div
                  className="admin-message admin-message-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {loginError}
                </motion.div>
              )}
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Логин"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="admin-input"
                  required
                  autoFocus
                />
              </div>
              <div className="form-row">
                <input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="btn-action btn-primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Войти
              </motion.button>
            </motion.form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Background />
      <div className="admin-container">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 className="admin-title" style={{ margin: 0 }}>Админ-панель</h1>
            <motion.button
              type="button"
              className="btn-action btn-secondary"
              onClick={handleLogout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Выйти
            </motion.button>
          </div>

          <div className="admin-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                id={`admin-tab-${t.id}`}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="admin-tabpanel"
                className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => handleTabChange(t.id)}
              >
                <span className="admin-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {priceMessage && (
              <motion.div
                key="toast"
                className={`admin-message admin-message-${priceMessage.type} admin-toast`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {priceMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              id="admin-tabpanel"
              role="tabpanel"
              aria-labelledby={`admin-tab-${tab}`}
              className="admin-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
            {tab === 'dashboard' && (
              <div className="admin-dashboard">
                <motion.div
                  className="admin-stats"
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
                >
                  <motion.div className="stat-card" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <div className="stat-label">Всего товаров</div>
                    <div className="stat-value">{stats.total}</div>
                  </motion.div>
                  <motion.div className="stat-card stat-card-green" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <div className="stat-label">С ценой</div>
                    <div className="stat-value">{stats.withPrice}</div>
                  </motion.div>
                  <motion.div className={`stat-card ${stats.withoutPrice > 0 ? 'stat-card-orange' : 'stat-card-green'}`} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <div className="stat-label">Без цены</div>
                    <div className="stat-value">{stats.withoutPrice}</div>
                  </motion.div>
                </motion.div>
                {healthData?.last_update && (
                  <motion.p
                    className="admin-dashboard-hint"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    style={{ marginTop: 8 }}
                  >
                    Данные обновлены: {new Date(healthData.last_update).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </motion.p>
                )}
                <motion.div
                  className="admin-dashboard-hint"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p>Перейдите в «Цены и скидки» для настройки скидок и кастомных цен, в «Парсер изображений» — для загрузки картинок, в «Портал» — просмотр товаров без папки в portal_export.</p>
                </motion.div>
                <motion.div
                  className="admin-dashboard-hint"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  style={{ marginTop: 12 }}
                >
                  <p style={{ marginBottom: 6 }}>Экспорт для SATU:</p>
                  <a
                    href={withBaseUrl('/api/admin/satu/export-excel')}
                    download="satu_import.xlsx"
                    className="admin-dashboard-link"
                    style={{ display: 'inline-block', padding: '8px 14px', background: 'var(--accent, #2563eb)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}
                  >
                    Скачать Excel для импорта в SATU
                  </a>
                </motion.div>
              </div>
            )}

            {tab === 'prices' && (
              <div className="admin-prices">
                {pricesLoading ? (
                  <div className="loading">
                    <div className="spinner"></div>
                    <p>Загрузка настроек...</p>
                  </div>
                ) : (
                  <>
                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Глобальная скидка (%)</h2>
                      <div className="form-row">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={globalDiscount}
                          onChange={e => setGlobalDiscount(e.target.value)}
                          placeholder="0"
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-primary" onClick={saveGlobalDiscount} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Сохранить</motion.button>
                      </div>
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Скидки по моделям</h2>
                      <div className="form-row">
                        <input
                          placeholder="Модель"
                          value={newModelDiscount.model}
                          onChange={e => setNewModelDiscount(prev => ({ ...prev, model: e.target.value }))}
                          className="admin-input"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="%"
                          value={newModelDiscount.discount}
                          onChange={e => setNewModelDiscount(prev => ({ ...prev, discount: e.target.value }))}
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-success" onClick={addModelDiscount} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Добавить</motion.button>
                      </div>
                      <motion.ul className="admin-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                        {Object.entries(modelDiscounts).map(([m, d]) => (
                          <motion.li key={m} className="list-item" variants={listItemVariants}>
                            <span>{m}: {d}%</span>
                            <motion.button type="button" className="btn-action btn-secondary danger btn-sm" onClick={() => removeModelDiscount(m)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Удалить</motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Скидки по брендам</h2>
                      <div className="form-row">
                        <input
                          placeholder="Бренд"
                          value={newBrandDiscount.brand}
                          onChange={e => setNewBrandDiscount(prev => ({ ...prev, brand: e.target.value }))}
                          className="admin-input"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="%"
                          value={newBrandDiscount.discount}
                          onChange={e => setNewBrandDiscount(prev => ({ ...prev, discount: e.target.value }))}
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-success" onClick={addBrandDiscount} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Добавить</motion.button>
                      </div>
                      <motion.ul className="admin-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                        {Object.entries(brandDiscounts).map(([b, d]) => (
                          <motion.li key={b} className="list-item" variants={listItemVariants}>
                            <span>{b}: {d}%</span>
                            <motion.button type="button" className="btn-action btn-secondary danger btn-sm" onClick={() => removeBrandDiscount(b)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Удалить</motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Кастомные цены (фикс. цена за модель)</h2>
                      <div className="form-row">
                        <input
                          placeholder="Модель"
                          value={newCustomPrice.model}
                          onChange={e => setNewCustomPrice(prev => ({ ...prev, model: e.target.value }))}
                          className="admin-input"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Цена ₸"
                          value={newCustomPrice.price}
                          onChange={e => setNewCustomPrice(prev => ({ ...prev, price: e.target.value }))}
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-success" onClick={addCustomPrice} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Добавить</motion.button>
                      </div>
                      <motion.ul className="admin-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                        {Object.entries(customPrices).map(([m, p]) => (
                          <motion.li key={m} className="list-item" variants={listItemVariants}>
                            <span>{m}: {p} ₸</span>
                            <motion.button type="button" className="btn-action btn-secondary danger btn-sm" onClick={() => removeCustomPrice(m)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Удалить</motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Поиск и кастомная цена по модели</h2>
                      <div className="form-row">
                        <input
                          placeholder="Модель товара"
                          value={searchModel}
                          onChange={e => setSearchModel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-primary" onClick={handleSearch} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Найти</motion.button>
                      </div>
                      {selectedProduct && (
                        <motion.div className="product-info" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                          <h3>{selectedProduct.name || selectedProduct.model}</h3>
                          <p><strong>Модель:</strong> {selectedProduct.model} <strong>Бренд:</strong> {selectedProduct.brand || '—'}</p>
                          <p><strong>Текущая цена:</strong> {selectedProduct.final_price != null ? `${selectedProduct.final_price} ₸` : 'не установлена'}</p>
                          <div className="form-row">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Цена ₸"
                              value={price}
                              onChange={e => setPrice(e.target.value)}
                              className="admin-input"
                            />
                            <motion.button type="button" className="btn-action btn-success" onClick={handleUpdatePrice} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Установить цену</motion.button>
                            <motion.button type="button" className="btn-action btn-secondary danger" onClick={handleDeletePrice} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Удалить цену</motion.button>
                          </div>
                        </motion.div>
                      )}
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Товары без цены (первые 50)</h2>
                      {!loading && withoutPriceBrands.length > 0 && (
                        <div className="form-row" style={{ marginBottom: 12 }}>
                          <label htmlFor="admin-brand-filter">Бренд:</label>
                          <select
                            id="admin-brand-filter"
                            className="admin-input"
                            value={brandFilter}
                            onChange={e => setBrandFilter(e.target.value)}
                            style={{ maxWidth: 220 }}
                          >
                            <option value="">Все бренды</option>
                            {withoutPriceBrands.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {loading ? (
                        <div className="loading">
                          <div className="spinner"></div>
                          <p>Загрузка...</p>
                        </div>
                      ) : (
                        <>
                          {withoutPriceFiltered.length > NOPRICE_PAGE_SIZE && (
                            <p className="admin-hint" style={{ marginBottom: 8 }}>Показано {withoutPrice.length} из {withoutPriceFiltered.length}.</p>
                          )}
                          <motion.div className="product-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                          {withoutPrice.map((p, idx) => (
                            <motion.div key={`noprice-${idx}-${p.model}`} className="list-item" variants={listItemVariants}>
                              <div>
                                <strong>{p.name || p.model}</strong>
                                <div className="list-item-meta">{p.model} {p.brand && `• ${p.brand}`}</div>
                              </div>
                              <motion.button type="button" className="btn-action btn-primary" onClick={() => { setSearchModel(p.model); setSelectedProduct(p); setPrice(''); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Установить цену</motion.button>
                            </motion.div>
                          ))}
                        </motion.div>
                        {hasMoreNoprice && (
                          <motion.button
                            type="button"
                            className="btn-action btn-secondary"
                            onClick={() => setWithoutPricePage(p => p + 1)}
                            style={{ marginTop: 12, width: '100%' }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Загрузить ещё ({withoutPriceFiltered.length - withoutPrice.length} из {withoutPriceFiltered.length})
                          </motion.button>
                        )}
                        </>
                      )}
                    </motion.section>
                  </>
                )}
              </div>
            )}

            {tab === 'visibility' && (
              <div className="admin-visibility">
                {visibilityLoading ? (
                  <div className="loading">
                    <div className="spinner"></div>
                    <p>Загрузка настроек...</p>
                  </div>
                ) : (
                  <>
                    <motion.div
                      className="admin-dashboard-hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <p>Скрытые товары не показываются в каталоге (ни на главном экране, ни в категориях). Данные не удаляются — товары можно вернуть в любой момент.</p>
                    </motion.div>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Скрыть бренд целиком</h2>
                      <div className="form-row">
                        <select
                          value={newHiddenBrand}
                          onChange={e => setNewHiddenBrand(e.target.value)}
                          className="admin-input"
                        >
                          <option value="">— выберите бренд —</option>
                          {availableBrands.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <motion.button type="button" className="btn-action btn-success" onClick={addHiddenBrand} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Скрыть</motion.button>
                      </div>
                      <motion.ul className="admin-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                        {hiddenBrands.length === 0 && (
                          <p className="admin-hint">Скрытых брендов нет.</p>
                        )}
                        {hiddenBrands.map(b => (
                          <motion.li key={b} className="list-item" variants={listItemVariants}>
                            <span>{b}</span>
                            <motion.button type="button" className="btn-action btn-secondary btn-sm" onClick={() => removeHiddenBrand(b)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Вернуть в каталог</motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.section>

                    <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                      <h2>Скрыть отдельную модель</h2>
                      <div className="form-row">
                        <input
                          placeholder="Модель товара"
                          value={newHiddenModel}
                          onChange={e => setNewHiddenModel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addHiddenModel()}
                          className="admin-input"
                        />
                        <motion.button type="button" className="btn-action btn-success" onClick={addHiddenModel} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Скрыть</motion.button>
                      </div>
                      <motion.ul className="admin-list" initial="hidden" animate="visible" variants={listContainerVariants}>
                        {hiddenModels.length === 0 && (
                          <p className="admin-hint">Скрытых моделей нет.</p>
                        )}
                        {hiddenModels.map(m => (
                          <motion.li key={m} className="list-item" variants={listItemVariants}>
                            <span>{m}</span>
                            <motion.button type="button" className="btn-action btn-secondary btn-sm" onClick={() => removeHiddenModel(m)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Вернуть в каталог</motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.section>
                  </>
                )}
              </div>
            )}

            {tab === 'parser' && (
              <div className="admin-parser">
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Парсер портала</h2>
                  {portalParserStatus?.error ? (
                    <p className="admin-error">{portalParserStatus.error}</p>
                  ) : portalParserStatus == null ? (
                    <div className="loading"><div className="spinner"></div><p>Загрузка статуса...</p></div>
                  ) : (
                    <>
                      <div className="admin-portal-parser-status">
                        <span className={`admin-portal-parser-badge ${portalParserStatus.running ? 'running' : 'stopped'}`}>
                          {portalParserStatus.running ? 'Работает' : 'Остановлен'}
                        </span>
                        {portalParserStatus?.started_at && (
                          <span className="admin-portal-parser-time">
                            Запущен: {formatDateTime(portalParserStatus.started_at)}
                          </span>
                        )}
                        <div className="form-actions" style={{ marginTop: 8 }}>
                          <motion.button
                            type="button"
                            className="btn-action btn-primary"
                            onClick={startPortalParser}
                            disabled={parserAction === 'portal' || portalParserStatus?.running}
                            whileHover={{ scale: parserAction === 'portal' ? 1 : 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {parserAction === 'portal' ? 'Запуск...' : 'Запустить'}
                          </motion.button>
                          <motion.button
                            type="button"
                            className="btn-action btn-secondary danger"
                            onClick={stopPortalParser}
                            disabled={!portalParserStatus?.running || parserAction === 'stop'}
                            whileHover={{ scale: parserAction === 'stop' ? 1 : 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {parserAction === 'stop' ? 'Остановка...' : 'Остановить парсер'}
                          </motion.button>
                        </div>
                      </div>
                      <div className="admin-portal-parser-logs">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <h3 style={{ margin: 0 }}>Лог действий</h3>
                          <motion.button
                            type="button"
                            className={`btn-action btn-sm ${logScrollPaused ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setLogScrollPaused(v => !v)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            title={logScrollPaused ? 'Включить авто-прокрутку' : 'Приостановить авто-прокрутку'}
                          >
                            {logScrollPaused ? '▶ Авто-прокрутка' : '⏸ Пауза'}
                          </motion.button>
                        </div>
                        <pre className="admin-log-view" ref={portalLogPreRef}>
                          {portalParserLogs.length
                            ? portalParserLogs.map((line, i) => {
                                const color = colorizeLogLine(line);
                                return (
                                  <span key={i} style={color ? { color } : undefined}>
                                    {line}{'\n'}
                                  </span>
                                );
                              })
                            : 'Нет записей. Запустите парсер.'}
                        </pre>
                      </div>
                    </>
                  )}
                </motion.section>
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Статус парсера изображений</h2>
                  {parserStatus?.error ? (
                    <p className="admin-error">{parserStatus.error}</p>
                  ) : parserStatus ? (
                    <ul className="admin-status-list">
                      <li>Включён: {parserStatus.enabled ? 'да' : 'нет'}</li>
                      <li>
                        Статус: <strong>{parserStatus.running ? 'работает' : 'остановлен'}</strong>
                      </li>
                      <li>Последний запуск: {formatDateTime(parserStatus.last_run)}</li>
                      <li>Макс. страниц: {parserStatus.max_pages ?? '—'}</li>
                    </ul>
                  ) : (
                    <div className="loading">
                      <div className="spinner"></div>
                      <p>Загрузка...</p>
                    </div>
                  )}
                </motion.section>
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Действия</h2>
                  <div className="form-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <motion.button
                        type="button"
                        className={`btn-action btn-success ${parserAction === 'start' ? 'is-loading' : ''}`}
                        onClick={startParser}
                        disabled={parserAction === 'start'}
                        whileHover={{ scale: parserAction === 'start' ? 1 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        animate={parserAction === 'start' ? { boxShadow: ['0 0 0 0 rgba(34, 197, 94, 0.35)', '0 0 0 10px rgba(34, 197, 94, 0)'] } : {}}
                        transition={{ duration: 1.2, repeat: parserAction === 'start' ? Infinity : 0 }}
                      >
                        {parserAction === 'start' ? 'Запуск...' : 'Запустить парсинг изображений'}
                      </motion.button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={parserMaxPages}
                        onChange={e => setParserMaxPages(Math.max(1, parseInt(e.target.value) || 1))}
                        className="admin-input"
                        style={{ width: 72, minWidth: 'unset' }}
                        title="Количество страниц для парсинга"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>стр.</span>
                    </div>
                    <motion.button
                      type="button"
                      className={`btn-action btn-secondary danger ${parserAction === 'clear' ? 'is-loading' : ''}`}
                      onClick={clearParserCache}
                      disabled={parserAction === 'clear'}
                      whileHover={{ scale: parserAction === 'clear' ? 1 : 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      animate={parserAction === 'clear' ? { boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.35)', '0 0 0 10px rgba(239, 68, 68, 0)'] } : {}}
                      transition={{ duration: 1.2, repeat: parserAction === 'clear' ? Infinity : 0 }}
                    >
                      {parserAction === 'clear' ? 'Очистка...' : 'Очистить кэш парсера'}
                    </motion.button>
                  </div>
                </motion.section>
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Статистика изображений</h2>
                  {parserStats?.error ? (
                    <p className="admin-error">{parserStats.error}</p>
                  ) : parserStats ? (
                    <ul className="admin-status-list">
                      <li>Товаров с изображениями: {parserStats.total_products ?? 0}</li>
                      <li>Всего изображений: {parserStats.total_images ?? 0}</li>
                    </ul>
                  ) : (
                    <div className="loading">
                      <div className="spinner"></div>
                      <p>Загрузка...</p>
                    </div>
                  )}
                </motion.section>
              </div>
            )}

            {tab === 'portal' && (
              <div className="admin-portal">
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Товары без папки в portal_export</h2>
                  {portalLoading ? (
                    <div className="loading">
                      <div className="spinner"></div>
                      <p>Загрузка...</p>
                    </div>
                  ) : portalMismatch?.error ? (
                    <p className="admin-error">{portalMismatch.error}</p>
                  ) : portalMismatch ? (
                    <>
                      <p>Всего товаров в B2B: {portalMismatch.total_products}. Без папки: {portalMismatch.missing_count}.</p>
                      {portalMissingFiltered.length > 50 && (
                        <p className="admin-hint" style={{ marginBottom: 8 }}>Показаны первые 50 из {portalMissingFiltered.length}.</p>
                      )}
                      <div className="form-actions" style={{ marginBottom: 16 }}>
                        <motion.button
                          type="button"
                          className="btn-action btn-success"
                          onClick={startPortalParserMissing}
                          disabled={!portalMismatch.missing_count || parserAction === 'missing'}
                          whileHover={{ scale: parserAction === 'missing' ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {parserAction === 'missing' ? 'Запуск...' : 'Запустить парсер для недостающих папок'}
                        </motion.button>
                      </div>
                      {!portalMismatch.missing_count && (
                        <p className="admin-hint">Недостающих папок нет. Парсер ищет наименования в каталоге портала и создаёт папки в portal_export.</p>
                      )}
                      <div className="form-row" style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          placeholder="Поиск по модели, названию, бренду..."
                          value={portalSearch}
                          onChange={e => setPortalSearch(e.target.value)}
                          className="admin-input"
                          style={{ flex: 1 }}
                        />
                        {portalSearch && (
                          <motion.button
                            type="button"
                            className="btn-action btn-secondary btn-sm"
                            onClick={() => setPortalSearch('')}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            ✕ Сбросить
                          </motion.button>
                        )}
                      </div>
                      {portalSearch && (
                        <p className="admin-hint" style={{ marginBottom: 8 }}>Фильтр: найдено {portalMissingFiltered.length} из {portalMismatch.missing_count}.</p>
                      )}
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Модель</th>
                              <th>Название</th>
                              <th>Бренд</th>
                              <th>Ожидаемая папка</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portalMissingFiltered.slice(0, 50).map((row, i) => (
                              <motion.tr
                                key={row.model + i}
                                initial={i < 10 ? { opacity: 0 } : false}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i < 10 ? i * 0.03 : 0 }}
                              >
                                <td>{row.model}</td>
                                <td>{row.name}</td>
                                <td>{row.brand}</td>
                                <td><code>{row.expected_folder || row.clean_id || '—'}</code></td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </motion.section>
              </div>
            )}
            </motion.div>
          </AnimatePresence>

            {tab === 'enrichment' && (
              <div className="admin-enrichment">
                <motion.section className="admin-section" initial="hidden" animate="visible" variants={sectionVariants}>
                  <h2>Обогащение товаров из complex.com.kz</h2>
                  <p className="admin-hint">
                    Скрипт парсит страницы товаров на complex.com.kz и сохраняет описания,
                    характеристики и бренд в product.json. Обогащённые товары пропускаются при повторном запуске.
                  </p>

                  {enrichmentStatus?.error ? (
                    <p className="admin-error">{enrichmentStatus.error}</p>
                  ) : enrichmentStatus == null ? (
                    <div className="loading"><div className="spinner"></div><p>Загрузка статуса...</p></div>
                  ) : (
                    <>
                      {/* Статус и статистика */}
                      <div className="enrichment-status-row">
                        <span className={`admin-portal-parser-badge ${enrichmentStatus.running ? 'running' : 'stopped'}`}>
                          {enrichmentStatus.running ? '⚡ Работает' : enrichmentStatus.done ? '✅ Завершено' : '⏸ Остановлен'}
                        </span>
                        {enrichmentStatus?.started_at && enrichmentStatus.running && (
                          <span className="admin-portal-parser-time">
                            Запущен: {new Date(enrichmentStatus.started_at).toLocaleTimeString('ru')}
                          </span>
                        )}
                      </div>

                      {/* Прогресс-бар */}
                      {(enrichmentStatus.total > 0) && (
                        <div className="enrichment-progress-wrap">
                          <div className="enrichment-progress-labels">
                            <span>Обогащено: <strong>{enrichmentStatus.enriched}</strong></span>
                            <span>Ошибок: <strong style={{color:'var(--color-danger, #f87171)'}}>{enrichmentStatus.failed}</strong></span>
                            <span>Всего: <strong>{enrichmentStatus.total}</strong></span>
                          </div>
                          <div className="enrichment-progress-bar-bg">
                            <motion.div
                              className="enrichment-progress-bar-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(((enrichmentStatus.enriched + enrichmentStatus.failed) / enrichmentStatus.total) * 100)}%` }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>
                          <div className="enrichment-progress-pct">
                            {Math.round(((enrichmentStatus.enriched + enrichmentStatus.failed) / enrichmentStatus.total) * 100)}%
                          </div>
                        </div>
                      )}

                      {/* Кнопки управления */}
                      <div className="form-actions" style={{ marginTop: 16 }}>
                        <motion.button
                          type="button"
                          className="btn-action btn-success"
                          onClick={() => startEnrichment(false)}
                          disabled={!!enrichmentStatus.running || enrichmentAction === 'start'}
                          whileHover={{ scale: enrichmentStatus.running ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          animate={enrichmentStatus.running ? { boxShadow: ['0 0 0 0 rgba(34,197,94,0.35)', '0 0 0 10px rgba(34,197,94,0)'] } : {}}
                          transition={{ duration: 1.2, repeat: enrichmentStatus.running ? Infinity : 0 }}
                        >
                          {enrichmentAction === 'start' ? 'Запуск...' : '▶ Запустить'}
                        </motion.button>
                        <motion.button
                          type="button"
                          className="btn-action btn-secondary"
                          onClick={() => startEnrichment(true)}
                          disabled={!!enrichmentStatus.running || enrichmentAction === 'start'}
                          whileHover={{ scale: enrichmentStatus.running ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          🔄 Перезапустить всё (force)
                        </motion.button>
                        <motion.button
                          type="button"
                          className="btn-action btn-secondary danger"
                          onClick={stopEnrichment}
                          disabled={!enrichmentStatus.running || enrichmentAction === 'stop'}
                          whileHover={{ scale: !enrichmentStatus.running ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {enrichmentAction === 'stop' ? 'Остановка...' : '⏹ Остановить'}
                        </motion.button>
                      </div>

                      {/* Лог */}
                      <div className="admin-portal-parser-logs" style={{ marginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <h3 style={{ margin: 0 }}>Лог обогащения</h3>
                          <motion.button
                            type="button"
                            className={`btn-action btn-sm ${enrichmentLogPaused ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setEnrichmentLogPaused(v => !v)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {enrichmentLogPaused ? '▶ Авто-прокрутка' : '⏸ Пауза'}
                          </motion.button>
                          <motion.button
                            type="button"
                            className="btn-action btn-sm btn-secondary"
                            onClick={loadEnrichmentLogs}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            🔁 Обновить
                          </motion.button>
                        </div>
                        <pre className="admin-log-view" ref={enrichLogRef}>
                          {enrichmentLogs.length
                            ? enrichmentLogs.map((line, i) => {
                                const color = colorizeLogLine(line);
                                return (
                                  <span key={i} style={color ? { color } : undefined}>
                                    {line}{'\n'}
                                  </span>
                                );
                              })
                            : 'Нет записей. Запустите обогащение.'}
                        </pre>
                      </div>
                    </>
                  )}
                </motion.section>
              </div>
            )}

          <div className="admin-footer">
            <MotionLink to="/" className="btn-action btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>← Вернуться в каталог</MotionLink>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            key="confirm"
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={closeConfirm}
          />
        )}
      </AnimatePresence>
    </>
  );
}
