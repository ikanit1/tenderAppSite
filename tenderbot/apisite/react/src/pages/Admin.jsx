import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { withBaseUrl } from '../utils/baseUrl';

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
  } else return '—';
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function colorizeLog(line) {
  if (/error|ошибка|fail|failed|exception/i.test(line)) return 'err';
  if (/warn|предупреждение|warning/i.test(line)) return 'warn';
  if (/\[ok\]|success|успешн|готово|создан|saved|done|found/i.test(line)) return 'ok';
  return 'info';
}

/* ---- SVG Icons ---- */
const IC = {
  dash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  price: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  image: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  sparkle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 5.6L19.5 10.5 14 12.4 12 18l-1.9-5.6L4.5 10.5 10.1 8.6z"/><path d="M19 19v2M20 20h-2"/></svg>,
  list: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  help: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
  pkg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  arrowUp: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6-6 6 6M12 3v18"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  play: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20"/></svg>,
  stop: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  logout: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Дашборд', icon: 'dash', group: 'Основное' },
  { id: 'prices', label: 'Цены и скидки', icon: 'price', group: 'Основное' },
  { id: 'visibility', label: 'Видимость', icon: 'eye', group: 'Основное' },
  { id: 'parser', label: 'Парсер изображений', icon: 'image', group: 'Интеграции', badge: 'live' },
  { id: 'portal', label: 'Портал', icon: 'search', group: 'Интеграции' },
  { id: 'enrichment', label: 'Обогащение', icon: 'sparkle', group: 'Интеграции' },
  { id: 'audit', label: 'Аудит', icon: 'list', group: 'Интеграции' },
];

const TAB_TITLE = {
  dashboard: 'Дашборд',
  prices: 'Цены и скидки',
  visibility: 'Видимость',
  parser: 'Парсер изображений',
  portal: 'Портал',
  enrichment: 'Обогащение каталога',
  audit: 'Журнал изменений',
};

/* ---- Reusable components ---- */
function Btn({ children, className = '', onClick, disabled, type = 'button', href, download }) {
  if (href) return <a href={href} download={download} className={`adm-btn ${className}`}>{children}</a>;
  return <button type={type} className={`adm-btn ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Tag({ children, color = '' }) {
  return <span className={`adm-tag${color ? ` ${color}` : ''}`}>{children}</span>;
}

function Pill({ children, type = '' }) {
  return (
    <span className={`adm-pill${type ? ` ${type}` : ''}`}>
      {type && <span className="adm-dot" />}
      {children}
    </span>
  );
}

function Kpi({ label, value, delta, deltaDown, bar, color, icon }) {
  return (
    <div className={`adm-kpi${color ? ` ${color}` : ''}`}>
      <div className="adm-kpi-row">
        <span className="adm-kpi-label">{label}</span>
        <span className="adm-kpi-ico">{IC[icon] || IC.pkg}</span>
      </div>
      <div className="adm-kpi-value">{value ?? '—'}</div>
      {delta && <div className={`adm-kpi-delta${deltaDown ? ' down' : ''}`}>{delta}</div>}
      {bar != null && (
        <div className="adm-kpi-bar">
          <div className="adm-kpi-fill" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`adm-card ${className}`}>{children}</div>;
}

function CardHead({ title, children }) {
  return (
    <div className="adm-card-head">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <span>Загрузка...</span>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="adm-modal-overlay" onClick={onCancel}>
      <motion.div
        className="adm-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <p>{message}</p>
        <div className="adm-modal-actions">
          <Btn onClick={onCancel} autoFocus>Отмена</Btn>
          <Btn className="danger" onClick={onConfirm}>Подтвердить</Btn>
        </div>
      </motion.div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
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
  const [healthData, setHealthData] = useState(null);

  const [pricesConfig, setPricesConfig] = useState(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [searchModel, setSearchModel] = useState('');
  const [price, setPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [newModelDiscount, setNewModelDiscount] = useState({ model: '', discount: '' });
  const [newBrandDiscount, setNewBrandDiscount] = useState({ brand: '', discount: '' });
  const [priceMessage, setPriceMessage] = useState(null);

  const [parserStatus, setParserStatus] = useState(null);
  const [parserStats, setParserStats] = useState(null);
  const [parserAction, setParserAction] = useState(null);
  const [parserMaxPages, setParserMaxPages] = useState(5);

  const [portalParserStatus, setPortalParserStatus] = useState(null);
  const [portalParserLogs, setPortalParserLogs] = useState([]);
  const portalLogRef = useRef(null);
  const [logScrollPaused, setLogScrollPaused] = useState(false);

  const [portalMismatch, setPortalMismatch] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalSearch, setPortalSearch] = useState('');

  const [enrichmentStatus, setEnrichmentStatus] = useState(null);
  const [enrichmentLogs, setEnrichmentLogs] = useState([]);
  const [enrichmentAction, setEnrichmentAction] = useState(null);
  const [enrichmentLogPaused, setEnrichmentLogPaused] = useState(false);
  const enrichLogRef = useRef(null);

  const [visibilityConfig, setVisibilityConfig] = useState(null);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [allBrandsList, setAllBrandsList] = useState([]);
  const [newHiddenBrand, setNewHiddenBrand] = useState('');
  const [newHiddenModel, setNewHiddenModel] = useState('');

  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [brandFilter, setBrandFilter] = useState('');
  const [withoutPricePage, setWithoutPricePage] = useState(1);
  const NOPRICE_PAGE_SIZE = 50;
  const [confirmModal, setConfirmModal] = useState(null);

  const showConfirm = useCallback((message, onConfirm) => setConfirmModal({ message, onConfirm }), []);
  const closeConfirm = useCallback(() => setConfirmModal(null), []);

  const priceTimerRef = useRef(null);
  const showPriceMsg = useCallback((type, text) => {
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
    setPriceMessage({ type, text });
    priceTimerRef.current = setTimeout(() => { setPriceMessage(null); priceTimerRef.current = null; }, 4000);
  }, []);
  useEffect(() => () => { if (priceTimerRef.current) clearTimeout(priceTimerRef.current); }, []);

  /* ---- Loaders ---- */
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/products');
      const list = data.products || [];
      setProducts(list);
      const withPrice = list.filter(p => p.final_price != null && p.final_price > 0).length;
      setStats({ total: list.length, withPrice, withoutPrice: list.length - withPrice });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const data = await api('/api/admin/prices');
      setPricesConfig(data);
      setGlobalDiscount(data.global_discount != null ? String(data.global_discount) : '');
    } catch (err) { showPriceMsg('error', err.message); } finally { setPricesLoading(false); }
  }, [showPriceMsg]);

  const loadParserStatus = useCallback(async () => {
    try { setParserStatus(await api('/api/parse-images/status')); } catch (err) { setParserStatus({ error: err.message }); }
  }, []);

  const loadParserStats = useCallback(async () => {
    try { setParserStats(await api('/api/parse-images/stats')); } catch (err) { setParserStats({ error: err.message }); }
  }, []);

  const loadPortalMismatch = useCallback(async () => {
    if (!authenticated) return;
    setPortalLoading(true);
    try { setPortalMismatch(await api('/api/admin/portal-mismatch')); } catch (err) { setPortalMismatch({ error: err.message }); } finally { setPortalLoading(false); }
  }, [authenticated]);

  const loadPortalParserStatus = useCallback(async () => {
    try { const d = await api('/api/portal-parser/status'); setPortalParserStatus(d); return d; }
    catch (err) { setPortalParserStatus({ running: false, error: err.message }); return null; }
  }, []);

  const LOGS_MAX = 150;
  const loadPortalParserLogs = useCallback(async () => {
    try { const d = await api(`/api/portal-parser/logs?limit=${LOGS_MAX}`); setPortalParserLogs((d.lines || []).slice(0, LOGS_MAX)); } catch { setPortalParserLogs([]); }
  }, []);

  const loadEnrichmentStatus = useCallback(async () => {
    try { const d = await api('/api/enrichment/status'); setEnrichmentStatus(d); return d; }
    catch (err) { setEnrichmentStatus({ running: false, error: err.message }); return null; }
  }, []);

  const loadEnrichmentLogs = useCallback(async () => {
    try { const d = await api(`/api/enrichment/logs?limit=${LOGS_MAX}`); setEnrichmentLogs((d.lines || []).slice(0, LOGS_MAX)); } catch { setEnrichmentLogs([]); }
  }, []);

  const loadVisibility = useCallback(async () => {
    setVisibilityLoading(true);
    try { setVisibilityConfig(await api('/api/admin/visibility')); } catch (err) { showPriceMsg('error', err.message); } finally { setVisibilityLoading(false); }
    try { const d = await api('/products?include_hidden=1&limit=1'); setAllBrandsList(d.brands || []); } catch { setAllBrandsList([]); }
  }, [showPriceMsg]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try { const d = await api('/api/admin/audit?limit=200'); setAuditEntries(d.entries || []); } catch (err) { showPriceMsg('error', err.message); } finally { setAuditLoading(false); }
  }, [showPriceMsg]);

  const checkAuth = useCallback(async () => {
    try { const d = await api('/api/admin/check'); setAuthenticated(d.authenticated || false); } catch { setAuthenticated(false); } finally { setCheckingAuth(false); }
  }, []);

  /* ---- Auth ---- */
  const handleLogin = useCallback(async e => {
    e.preventDefault(); setLoginError('');
    try {
      await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ login, password }) });
      setAuthenticated(true); setLogin(''); setPassword('');
    } catch (err) { setLoginError(err.message || 'Неверный логин или пароль'); }
  }, [login, password]);

  const handleLogout = useCallback(async () => {
    try { await api('/api/admin/logout', { method: 'POST', credentials: 'include' }); setAuthenticated(false); } catch {}
  }, []);

  /* ---- Effects ---- */
  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => { if (!authenticated) return; if (tab === 'dashboard' || tab === 'prices') loadProducts(); }, [tab, loadProducts, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'dashboard') api('/health').then(setHealthData).catch(() => setHealthData(null)); }, [tab, authenticated]);
  useEffect(() => {
    if (!authenticated || tab !== 'dashboard') return;
    const t = setInterval(() => { api('/health').then(setHealthData).catch(() => null); loadProducts(); }, 60000);
    return () => clearInterval(t);
  }, [authenticated, tab, loadProducts]);
  useEffect(() => { if (!authenticated) return; if (tab === 'prices') loadPrices(); }, [tab, loadPrices, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'parser') { loadParserStatus(); loadParserStats(); loadPortalParserStatus(); loadPortalParserLogs(); } }, [tab, loadParserStatus, loadParserStats, loadPortalParserStatus, loadPortalParserLogs, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'portal') loadPortalMismatch(); }, [tab, loadPortalMismatch, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'enrichment') { loadEnrichmentStatus(); loadEnrichmentLogs(); } }, [tab, loadEnrichmentStatus, loadEnrichmentLogs, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'visibility') loadVisibility(); }, [tab, loadVisibility, authenticated]);
  useEffect(() => { if (!authenticated) return; if (tab === 'audit') loadAudit(); }, [tab, loadAudit, authenticated]);
  useEffect(() => { setWithoutPricePage(1); }, [brandFilter]);

  useEffect(() => {
    if (!authenticated || tab !== 'parser' || !portalParserStatus?.running) return;
    let ignore = false;
    const t = setInterval(async () => {
      if (ignore) return;
      const s = await loadPortalParserStatus();
      if (ignore || !s?.running) return;
      loadPortalParserLogs();
    }, 2000);
    return () => { ignore = true; clearInterval(t); };
  }, [authenticated, tab, portalParserStatus?.running, loadPortalParserStatus, loadPortalParserLogs]);

  useEffect(() => {
    if (!authenticated || logScrollPaused) return;
    if (portalLogRef.current && portalParserLogs.length) portalLogRef.current.scrollTop = portalLogRef.current.scrollHeight;
  }, [portalParserLogs, authenticated, logScrollPaused]);

  useEffect(() => {
    if (!authenticated || tab !== 'enrichment' || !enrichmentStatus?.running) return;
    let ignore = false;
    const t = setInterval(async () => {
      if (ignore) return;
      const s = await loadEnrichmentStatus();
      if (ignore || !s?.running) return;
      loadEnrichmentLogs();
    }, 2000);
    return () => { ignore = true; clearInterval(t); };
  }, [authenticated, tab, enrichmentStatus?.running, loadEnrichmentStatus, loadEnrichmentLogs]);

  useEffect(() => {
    if (!authenticated || enrichmentLogPaused) return;
    if (enrichLogRef.current && enrichmentLogs.length) enrichLogRef.current.scrollTop = enrichLogRef.current.scrollHeight;
  }, [enrichmentLogs, authenticated, enrichmentLogPaused]);

  /* ---- Prices handlers ---- */
  const handleSearch = async () => {
    if (!searchModel.trim()) { showPriceMsg('error', 'Введите модель'); return; }
    try { const p = await api(`/products/${encodeURIComponent(searchModel)}`); setSelectedProduct(p); setPrice(p.final_price != null ? String(p.final_price) : ''); }
    catch { showPriceMsg('error', 'Товар не найден'); setSelectedProduct(null); }
  };
  const handleUpdatePrice = async () => {
    if (!selectedProduct || !price.trim()) { showPriceMsg('error', 'Введите цену'); return; }
    const v = parseFloat(price);
    if (isNaN(v) || v < 0) { showPriceMsg('error', 'Некорректная цена'); return; }
    try {
      await api('/api/admin/prices/custom-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedProduct.model, price: v }) });
      showPriceMsg('success', 'Кастомная цена установлена'); setSelectedProduct({ ...selectedProduct, final_price: v }); loadProducts(); loadPrices();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const handleDeletePrice = () => {
    if (!selectedProduct) return;
    showConfirm('Удалить кастомную цену для этого товара?', async () => {
      closeConfirm();
      try {
        await api(`/api/admin/prices/custom-price/${encodeURIComponent(selectedProduct.model)}`, { method: 'DELETE' });
        showPriceMsg('success', 'Цена удалена'); setSelectedProduct({ ...selectedProduct, final_price: null }); loadProducts(); loadPrices();
      } catch (err) { showPriceMsg('error', err.message); }
    });
  };
  const saveGlobalDiscount = async () => {
    const v = parseFloat(globalDiscount);
    if (isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/global-discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discount: v }) });
      showPriceMsg('success', `Глобальная скидка: ${v}%`); loadPrices();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const addModelDiscount = async () => {
    const model = (newModelDiscount.model || '').trim();
    const v = parseFloat(newModelDiscount.discount);
    if (!model || isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Модель и скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/model-discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, discount: v }) });
      showPriceMsg('success', `Скидка для ${model}: ${v}%`); setNewModelDiscount({ model: '', discount: '' }); loadPrices();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const removeModelDiscount = async model => {
    try { await api(`/api/admin/prices/model-discount/${encodeURIComponent(model)}`, { method: 'DELETE' }); showPriceMsg('success', `Скидка для ${model} удалена`); loadPrices(); }
    catch (err) { showPriceMsg('error', err.message); }
  };
  const addBrandDiscount = async () => {
    const brand = (newBrandDiscount.brand || '').trim();
    const v = parseFloat(newBrandDiscount.discount);
    if (!brand || isNaN(v) || v < 0 || v > 100) { showPriceMsg('error', 'Бренд и скидка 0–100%'); return; }
    try {
      await api('/api/admin/prices/brand-discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand, discount: v }) });
      showPriceMsg('success', `Скидка для бренда ${brand}: ${v}%`); setNewBrandDiscount({ brand: '', discount: '' }); loadPrices();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const removeBrandDiscount = async brand => {
    try { await api(`/api/admin/prices/brand-discount/${encodeURIComponent(brand)}`, { method: 'DELETE' }); showPriceMsg('success', `Скидка для бренда ${brand} удалена`); loadPrices(); }
    catch (err) { showPriceMsg('error', err.message); }
  };
  const addHiddenBrand = async () => {
    const brand = (newHiddenBrand || '').trim();
    if (!brand) { showPriceMsg('error', 'Выберите бренд'); return; }
    try {
      await api('/api/admin/visibility/brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand }) });
      showPriceMsg('success', `Бренд ${brand} скрыт`); setNewHiddenBrand(''); loadVisibility();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const removeHiddenBrand = async brand => {
    try { await api(`/api/admin/visibility/brand/${encodeURIComponent(brand)}`, { method: 'DELETE' }); showPriceMsg('success', `Бренд ${brand} снова виден`); loadVisibility(); }
    catch (err) { showPriceMsg('error', err.message); }
  };
  const addHiddenModel = async () => {
    const model = (newHiddenModel || '').trim();
    if (!model) { showPriceMsg('error', 'Введите модель'); return; }
    try {
      await api('/api/admin/visibility/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
      showPriceMsg('success', `Модель ${model} скрыта`); setNewHiddenModel(''); loadVisibility();
    } catch (err) { showPriceMsg('error', err.message); }
  };
  const removeHiddenModel = async model => {
    try { await api(`/api/admin/visibility/model/${encodeURIComponent(model)}`, { method: 'DELETE' }); showPriceMsg('success', `Модель ${model} снова видна`); loadVisibility(); }
    catch (err) { showPriceMsg('error', err.message); }
  };
  const startParser = async () => {
    setParserAction('start');
    try { await api(`/api/parse-images/start?max_pages=${parserMaxPages}`, { method: 'POST' }); showPriceMsg('success', 'Парсинг запущен'); loadParserStatus(); loadParserStats(); }
    catch (err) { showPriceMsg('error', err.message); } finally { setParserAction(null); }
  };
  const startPortalParser = async () => {
    setParserAction('portal');
    try {
      await api('/api/portal-parser/start?start_page=1&end_page=0', { method: 'POST' });
      showPriceMsg('success', 'Парсер портала запущен'); loadPortalParserStatus(); loadPortalParserLogs();
      setTimeout(() => { loadParserStatus(); loadParserStats(); }, 2000);
    } catch (err) { showPriceMsg('error', err.message); } finally { setParserAction(null); }
  };
  const stopPortalParser = () => {
    if (!portalParserStatus?.running) return;
    showConfirm('Остановить парсер портала?', async () => {
      closeConfirm(); setParserAction('stop');
      try { await api('/api/portal-parser/stop', { method: 'POST' }); showPriceMsg('success', 'Парсер остановлен'); loadPortalParserStatus(); loadPortalParserLogs(); }
      catch (err) { showPriceMsg('error', err.message); } finally { setParserAction(null); }
    });
  };
  const startPortalParserMissing = async () => {
    if (!portalMismatch?.missing_count) return;
    setParserAction('missing');
    try {
      const r = await api('/api/portal-parser/start-missing', { method: 'POST' });
      showPriceMsg('success', r.message || `Парсер запущен для ${r.count || 0} папок`);
      loadPortalParserStatus(); loadPortalParserLogs(); loadPortalMismatch();
    } catch (err) { showPriceMsg('error', err.message); } finally { setParserAction(null); }
  };
  const startEnrichment = async (force = false) => {
    setEnrichmentAction('start');
    try { await api(`/api/enrichment/start${force ? '?force=true' : ''}`, { method: 'POST' }); showPriceMsg('success', 'Обогащение запущено'); loadEnrichmentStatus(); loadEnrichmentLogs(); }
    catch (err) { showPriceMsg('error', err.message); } finally { setEnrichmentAction(null); }
  };
  const stopEnrichment = () => {
    if (!enrichmentStatus?.running) return;
    showConfirm('Остановить обогащение?', async () => {
      closeConfirm(); setEnrichmentAction('stop');
      try { await api('/api/enrichment/stop', { method: 'POST' }); showPriceMsg('success', 'Обогащение остановлено'); loadEnrichmentStatus(); loadEnrichmentLogs(); }
      catch (err) { showPriceMsg('error', err.message); } finally { setEnrichmentAction(null); }
    });
  };
  const clearParserCache = () => {
    showConfirm('Очистить кэш парсера?', async () => {
      closeConfirm(); setParserAction('clear');
      try { const r = await api('/api/parse-images/clear-cache', { method: 'POST' }); showPriceMsg('success', r.message || 'Кэш очищен'); loadParserStatus(); loadParserStats(); }
      catch (err) { showPriceMsg('error', err.message); } finally { setParserAction(null); }
    });
  };

  /* ---- Derived ---- */
  const modelDiscounts = pricesConfig?.model_discounts || {};
  const brandDiscounts = pricesConfig?.brand_discounts || {};
  const hiddenBrands = visibilityConfig?.hidden_brands || [];
  const hiddenModels = visibilityConfig?.hidden_models || [];
  const availableBrands = allBrandsList.filter(b => !hiddenBrands.some(hb => hb.toLowerCase() === b.toLowerCase()));
  const withoutPriceAll = products.filter(p => !p.final_price || p.final_price <= 0);
  const withoutPriceFiltered = brandFilter ? withoutPriceAll.filter(p => p.brand === brandFilter) : withoutPriceAll;
  const withoutPrice = withoutPriceFiltered.slice(0, withoutPricePage * NOPRICE_PAGE_SIZE);
  const hasMoreNoprice = withoutPriceFiltered.length > withoutPrice.length;
  const withoutPriceBrands = [...new Set(withoutPriceAll.map(p => p.brand).filter(Boolean))].sort();
  const portalMissingFiltered = (() => {
    const all = portalMismatch?.missing || [];
    if (!portalSearch.trim()) return all;
    const q = portalSearch.toLowerCase();
    return all.filter(r => (r.model || '').toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q));
  })();

  const pctWithPrice = stats.total ? Math.round((stats.withPrice / stats.total) * 100) : 0;

  /* ========== RENDER: LOADING ========== */
  if (checkingAuth) {
    return (
      <div className="adm-app" style={{ gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="adm-loading"><div className="adm-spinner" /><span>Проверка авторизации...</span></div>
        </div>
      </div>
    );
  }

  /* ========== RENDER: LOGIN ========== */
  if (!authenticated) {
    return (
      <div className="adm-app" style={{ gridTemplateColumns: '1fr' }}>
        <div className="adm-login-wrap">
          <div className="adm-login-box">
            <div className="adm-login-title">Вход в систему</div>
            <div className="adm-login-sub">Каталог · Админ-панель</div>
            {loginError && <div className="adm-login-error">{loginError}</div>}
            <form className="adm-login-form" onSubmit={handleLogin}>
              <div className="adm-field">
                <label className="adm-label">Логин</label>
                <input className="adm-input" type="text" value={login} onChange={e => setLogin(e.target.value)} autoFocus required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Пароль</label>
                <input className="adm-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Btn type="submit" className="primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                Войти
              </Btn>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ========== RENDER: MAIN ========== */
  const navGroups = ['Основное', 'Интеграции'];

  return (
    <div className="adm-app">
      {/* ---- SIDEBAR ---- */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <div className="adm-brand-mark" />
          <div>
            <div className="adm-brand-title">Каталог</div>
            <div className="adm-brand-sub">Админ-панель v2</div>
          </div>
        </div>

        {navGroups.map(group => (
          <nav key={group} className="adm-nav-group">
            <div className="adm-nav-label">{group}</div>
            {NAV_ITEMS.filter(n => n.group === group).map(n => (
              <div
                key={n.id}
                className={`adm-nav-item${tab === n.id ? ' active' : ''}`}
                onClick={() => setTab(n.id)}
              >
                <span className="adm-nav-icon">{IC[n.icon]}</span>
                {n.label}
                {n.badge && <span className="adm-nav-count hot">{n.badge}</span>}
              </div>
            ))}
          </nav>
        ))}

        <div className="adm-side-foot">
          <div className="adm-avatar">АД</div>
          <div style={{ minWidth: 0 }}>
            <div className="adm-foot-name">Администратор</div>
            <div className="adm-foot-role">grgroup.kz</div>
          </div>
          <button className="adm-icon-mini" style={{ marginLeft: 'auto' }} onClick={handleLogout} title="Выйти">
            {IC.logout}
          </button>
        </div>
      </aside>

      {/* ---- MAIN ---- */}
      <main className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <div className="adm-crumbs">
            <span>Админка</span>
            <span className="adm-crumb-sep">/</span>
            <strong>{TAB_TITLE[tab] || tab}</strong>
          </div>

          <div className="adm-search" style={{ marginLeft: 20 }}>
            <span style={{ opacity: 0.5 }}>{IC.search}</span>
            <input placeholder="Поиск по моделям, брендам, артикулам…" />
            <kbd>⌘K</kbd>
          </div>

          <div className="adm-top-actions">
            {portalParserStatus?.running && (
              <Pill type="live">Парсер портала</Pill>
            )}
            {enrichmentStatus?.running && (
              <Pill type="live">Обогащение</Pill>
            )}
            {stats.withoutPrice > 0 && (
              <Pill type="warn">{stats.withoutPrice} без цены</Pill>
            )}
            <button className="adm-icon-btn" title="Уведомления">{IC.bell}</button>
            <Link to="/" className="adm-btn sm">{IC.back} Каталог</Link>
          </div>
        </header>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="adm-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/* ===== DASHBOARD ===== */}
            {tab === 'dashboard' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Дашборд каталога</h1>
                    <div className="adm-page-sub">
                      {healthData?.last_update
                        ? `Обновлено: ${new Date(healthData.last_update).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                        : 'Состояние товаров, цен и интеграций'}
                    </div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn onClick={loadProducts}>{IC.refresh} Обновить</Btn>
                    <Btn href={withBaseUrl('/api/admin/satu/export-excel')} download="satu_import.xlsx">{IC.download} Excel для SATU</Btn>
                    <Btn className="primary" onClick={() => setTab('parser')}>{IC.play} Запустить парсер</Btn>
                  </div>
                </div>

                <div className="adm-kpi-grid">
                  <Kpi label="Всего товаров" value={loading ? '…' : stats.total.toLocaleString('ru')} delta={`+${stats.withPrice} с ценой`} bar={92} icon="pkg" />
                  <Kpi label="С ценой" value={loading ? '…' : stats.withPrice.toLocaleString('ru')} delta={`${pctWithPrice}% покрытия`} bar={pctWithPrice} icon="check" color="mint" />
                  <Kpi label="Без цены" value={loading ? '…' : stats.withoutPrice.toLocaleString('ru')} delta={stats.withoutPrice > 0 ? 'требует внимания' : 'всё ок'} deltaDown={stats.withoutPrice > 0} bar={stats.total ? Math.round((stats.withoutPrice / stats.total) * 100) : 0} icon="alert" color={stats.withoutPrice > 0 ? 'amber' : ''} />
                  <Kpi label="Скрытые позиции" value={loading ? '…' : (hiddenBrands.length + hiddenModels.length)} delta={`${hiddenBrands.length} брендов · ${hiddenModels.length} моделей`} bar={8} icon="eye" color="rose" />
                </div>

                <div className="adm-grid-2">
                  <Card>
                    <CardHead title="Сервисы и интеграции">
                      <div className="adm-spacer" />
                      <Pill type="live">все онлайн</Pill>
                    </CardHead>
                    <div className="adm-card-body">
                      <ul className="adm-status-list">
                        <li className="adm-status-row"><span className="adm-status-k">API каталога</span><span className="adm-status-v"><Tag color="mint">Работает</Tag></span></li>
                        <li className="adm-status-row"><span className="adm-status-k">Парсер изображений</span><span className="adm-status-v"><Tag color={parserStatus?.running ? 'mint' : 'amber'}>{parserStatus?.running ? 'работает' : (parserStatus ? 'остановлен' : '…')}</Tag></span></li>
                        <li className="adm-status-row"><span className="adm-status-k">Парсер портала</span><span className="adm-status-v"><Tag color={portalParserStatus?.running ? 'mint' : ''}>{portalParserStatus?.running ? 'работает' : (portalParserStatus ? 'остановлен' : '…')}</Tag></span></li>
                        <li className="adm-status-row"><span className="adm-status-k">Обогащение</span><span className="adm-status-v"><Tag color={enrichmentStatus?.running ? 'mint' : ''}>{enrichmentStatus?.running ? 'работает' : (enrichmentStatus?.done ? 'завершено' : (enrichmentStatus ? 'остановлено' : '…'))}</Tag></span></li>
                        <li className="adm-status-row"><span className="adm-status-k">Товаров без папки</span><span className="adm-status-v"><Tag color={portalMismatch?.missing_count ? 'rose' : 'mint'}>{portalMismatch?.missing_count ?? '…'}</Tag></span></li>
                      </ul>
                    </div>
                  </Card>

                  <Card>
                    <CardHead title="Быстрые действия">
                      <div className="adm-spacer" />
                    </CardHead>
                    <div className="adm-card-body">
                      <div className="adm-activity">
                        <div className="adm-activity-row">
                          <div className="adm-activity-ico mint">{IC.price}</div>
                          <div className="adm-activity-main">
                            <strong>Цены и скидки</strong>
                            <div className="adm-activity-desc">Настройка скидок и кастомных цен</div>
                          </div>
                          <Btn className="sm ghost" onClick={() => setTab('prices')}>→</Btn>
                        </div>
                        <div className="adm-activity-row">
                          <div className="adm-activity-ico">{IC.image}</div>
                          <div className="adm-activity-main">
                            <strong>Парсер изображений</strong>
                            <div className="adm-activity-desc">Загрузка картинок товаров</div>
                          </div>
                          <Btn className="sm ghost" onClick={() => setTab('parser')}>→</Btn>
                        </div>
                        <div className="adm-activity-row">
                          <div className="adm-activity-ico amber">{IC.search}</div>
                          <div className="adm-activity-main">
                            <strong>Портал</strong>
                            <div className="adm-activity-desc">Товары без папки в portal_export</div>
                          </div>
                          <Btn className="sm ghost" onClick={() => setTab('portal')}>→</Btn>
                        </div>
                        <div className="adm-activity-row">
                          <div className="adm-activity-ico">{IC.sparkle}</div>
                          <div className="adm-activity-main">
                            <strong>Обогащение</strong>
                            <div className="adm-activity-desc">Описания и характеристики</div>
                          </div>
                          <Btn className="sm ghost" onClick={() => setTab('enrichment')}>→</Btn>
                        </div>
                        <div className="adm-activity-row">
                          <div className="adm-activity-ico rose">{IC.list}</div>
                          <div className="adm-activity-main">
                            <strong>Аудит</strong>
                            <div className="adm-activity-desc">Журнал всех изменений</div>
                          </div>
                          <Btn className="sm ghost" onClick={() => setTab('audit')}>→</Btn>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* ===== PRICES ===== */}
            {tab === 'prices' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Цены и скидки</h1>
                    <div className="adm-page-sub">Глобальная скидка · бренды · модели. Кастомная цена перекрывает все скидки.</div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn href={withBaseUrl('/api/admin/satu/export-excel')} download="satu_import.xlsx">{IC.download} Экспорт Excel</Btn>
                  </div>
                </div>

                {pricesLoading ? <Loading /> : (
                  <div className="adm-grid-3">
                    {/* Global discount */}
                    <Card>
                      <CardHead title="Глобальная скидка">
                        <div className="adm-spacer" />
                        <Tag color={pricesConfig?.global_discount > 0 ? 'mint' : ''}>
                          {pricesConfig?.global_discount != null ? `${pricesConfig.global_discount}%` : 'не задана'}
                        </Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-field">
                          <label className="adm-label">Процент скидки</label>
                          <div className="adm-input-wrap">
                            <input className="adm-input" type="number" min="0" max="100" step="0.5" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} placeholder="0" style={{ paddingRight: 32 }} />
                            <span className="adm-suffix">%</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn className="primary" onClick={saveGlobalDiscount} style={{ flex: 1, justifyContent: 'center' }}>{IC.check} Применить</Btn>
                          <Btn onClick={() => { setGlobalDiscount('0'); }}>Сбросить</Btn>
                        </div>
                        <div className="adm-minitiles">
                          <div className="adm-minitile"><div className="k">С ценой</div><div className="v mint">{stats.withPrice.toLocaleString('ru')}</div></div>
                          <div className="adm-minitile"><div className="k">Без цены</div><div className="v amber">{stats.withoutPrice.toLocaleString('ru')}</div></div>
                          <div className="adm-minitile"><div className="k">Покрытие</div><div className="v">{pctWithPrice}%</div></div>
                        </div>
                      </div>
                    </Card>

                    {/* Brand discounts */}
                    <Card>
                      <CardHead title="Скидки по брендам">
                        <div className="adm-spacer" />
                        <Tag>{Object.keys(brandDiscounts).length} правил</Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-form-cols">
                          <div className="adm-field">
                            <label className="adm-label">Бренд</label>
                            <input className="adm-input" placeholder="Бренд" value={newBrandDiscount.brand} onChange={e => setNewBrandDiscount(p => ({ ...p, brand: e.target.value }))} />
                          </div>
                          <div className="adm-field">
                            <label className="adm-label">%</label>
                            <div className="adm-input-wrap">
                              <input className="adm-input" type="number" min="0" max="100" step="0.5" placeholder="0" value={newBrandDiscount.discount} onChange={e => setNewBrandDiscount(p => ({ ...p, discount: e.target.value }))} style={{ paddingRight: 28 }} />
                              <span className="adm-suffix">%</span>
                            </div>
                          </div>
                          <Btn className="primary" onClick={addBrandDiscount} style={{ alignSelf: 'flex-end' }}>{IC.plus}</Btn>
                        </div>
                        <div>
                          {Object.entries(brandDiscounts).map(([b, d]) => (
                            <div key={b} className="adm-item-row">
                              <div className="adm-item-label"><strong>{b}</strong></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="adm-item-val mint">−{d}%</span>
                                <div className="adm-item-actions">
                                  <button className="adm-icon-mini danger" onClick={() => removeBrandDiscount(b)}>{IC.trash}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {Object.keys(brandDiscounts).length === 0 && <p className="adm-hint">Скидок по брендам нет</p>}
                        </div>
                      </div>
                    </Card>

                    {/* Model discounts */}
                    <Card>
                      <CardHead title="Скидки по моделям">
                        <div className="adm-spacer" />
                        <Tag>{Object.keys(modelDiscounts).length} правил</Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-form-cols">
                          <div className="adm-field">
                            <label className="adm-label">Модель</label>
                            <input className="adm-input" placeholder="напр. SM-2G" value={newModelDiscount.model} onChange={e => setNewModelDiscount(p => ({ ...p, model: e.target.value }))} />
                          </div>
                          <div className="adm-field">
                            <label className="adm-label">%</label>
                            <div className="adm-input-wrap">
                              <input className="adm-input" type="number" min="0" max="100" step="0.5" placeholder="0" value={newModelDiscount.discount} onChange={e => setNewModelDiscount(p => ({ ...p, discount: e.target.value }))} style={{ paddingRight: 28 }} />
                              <span className="adm-suffix">%</span>
                            </div>
                          </div>
                          <Btn className="primary" onClick={addModelDiscount} style={{ alignSelf: 'flex-end' }}>{IC.plus}</Btn>
                        </div>
                        <div>
                          {Object.entries(modelDiscounts).map(([m, d]) => (
                            <div key={m} className="adm-item-row">
                              <div className="adm-item-label"><strong>{m}</strong></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="adm-item-val">−{d}%</span>
                                <div className="adm-item-actions">
                                  <button className="adm-icon-mini danger" onClick={() => removeModelDiscount(m)}>{IC.trash}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {Object.keys(modelDiscounts).length === 0 && <p className="adm-hint">Скидок по моделям нет</p>}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Search & custom price */}
                {!pricesLoading && (
                  <div className="adm-grid-2">
                    <Card>
                      <CardHead title="Поиск товара и кастомная цена">
                        <div className="adm-spacer" />
                        <Tag color="muted">приоритет 1</Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-row-inputs-1a">
                          <div className="adm-field">
                            <label className="adm-label">Модель</label>
                            <input className="adm-input" placeholder="Модель товара" value={searchModel} onChange={e => setSearchModel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                          </div>
                          <Btn onClick={handleSearch} style={{ alignSelf: 'flex-end' }}>{IC.search} Найти</Btn>
                        </div>

                        {selectedProduct && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 16, border: '1px solid var(--adm-line-strong)', borderRadius: 14, background: 'linear-gradient(135deg, rgba(157,122,255,0.08), transparent 80%)' }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                              <div style={{ width: 56, height: 56, borderRadius: 10, background: 'linear-gradient(135deg, #1a0d3a, #0a0420)', display: 'grid', placeItems: 'center', border: '1px solid var(--adm-line)', color: 'var(--adm-text-3)', fontSize: 9, textAlign: 'center', padding: 4 }}>
                                {selectedProduct.model}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--adm-text)' }}>{selectedProduct.name || selectedProduct.model}</div>
                                <div style={{ color: 'var(--adm-text-3)', fontSize: 12, marginTop: 4 }}>Бренд: {selectedProduct.brand || '—'} · Артикул: {selectedProduct.model}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: 'var(--adm-text-3)' }}>Итоговая</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--adm-text)', fontVariantNumeric: 'tabular-nums' }}>
                                  {selectedProduct.final_price != null ? `${selectedProduct.final_price.toLocaleString('ru')} ₸` : '—'}
                                </div>
                              </div>
                            </div>
                            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
                              <div className="adm-field">
                                <label className="adm-label">Кастомная цена</label>
                                <div className="adm-input-wrap">
                                  <input className="adm-input" type="number" min="0" step="0.01" placeholder="Цена ₸" value={price} onChange={e => setPrice(e.target.value)} style={{ paddingRight: 28 }} />
                                  <span className="adm-suffix">₸</span>
                                </div>
                              </div>
                              <Btn className="primary" onClick={handleUpdatePrice} style={{ alignSelf: 'flex-end' }}>{IC.check} Сохранить</Btn>
                              <Btn className="danger" onClick={handleDeletePrice} style={{ alignSelf: 'flex-end' }}>{IC.trash}</Btn>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </Card>

                    <Card>
                      <CardHead title="Товары без цены">
                        <div className="adm-spacer" />
                        {withoutPriceBrands.length > 0 && (
                          <select className="adm-select" style={{ minWidth: 140, fontSize: 12 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                            <option value="">Все бренды</option>
                            {withoutPriceBrands.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        )}
                        <Tag color="amber">{withoutPriceFiltered.length}</Tag>
                      </CardHead>
                      <div className="adm-card-body" style={{ padding: 0 }}>
                        {loading ? <Loading /> : (
                          <table className="adm-dt">
                            <thead><tr><th>Модель</th><th>Название</th><th>Бренд</th><th style={{ textAlign: 'right' }}>Действие</th></tr></thead>
                            <tbody>
                              {withoutPrice.slice(0, 8).map((p, i) => (
                                <tr key={`${p.model}-${i}`}>
                                  <td className="mono">{p.model}</td>
                                  <td>{p.name || '—'}</td>
                                  <td className="muted">{p.brand || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <Btn className="sm primary" onClick={() => { setSearchModel(p.model); setSelectedProduct(p); setPrice(''); }}>Установить</Btn>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      {hasMoreNoprice && (
                        <div className="adm-card-foot">
                          Показано {withoutPrice.length} из {withoutPriceFiltered.length} ·{' '}
                          <button className="adm-link" onClick={() => setWithoutPricePage(p => p + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            загрузить ещё →
                          </button>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </>
            )}

            {/* ===== VISIBILITY ===== */}
            {tab === 'visibility' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Видимость</h1>
                    <div className="adm-page-sub">Скрытые позиции не показываются в каталоге, но данные не удаляются.</div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn onClick={loadVisibility}>{IC.refresh} Обновить</Btn>
                  </div>
                </div>

                <div className="adm-kpi-grid">
                  <Kpi label="Видимых товаров" value={stats.total - hiddenBrands.length - hiddenModels.length} delta={`${pctWithPrice}% каталога`} bar={pctWithPrice} icon="eye" />
                  <Kpi label="Скрытые бренды" value={hiddenBrands.length} delta="из базы" bar={hiddenBrands.length * 8} icon="trash" color="rose" />
                  <Kpi label="Скрытые модели" value={hiddenModels.length} delta="точечные исключения" bar={hiddenModels.length * 2} icon="pkg" color="amber" />
                  <Kpi label="Изменений сегодня" value="—" delta="аудит →" icon="edit" color="mint" />
                </div>

                {visibilityLoading ? <Loading /> : (
                  <div className="adm-grid-2-eq">
                    <Card>
                      <CardHead title="Скрытые бренды">
                        <div className="adm-spacer" />
                        <Tag color="rose">{hiddenBrands.length}</Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-row-inputs-1a">
                          <div className="adm-field">
                            <label className="adm-label">Добавить бренд</label>
                            <select className="adm-select" value={newHiddenBrand} onChange={e => setNewHiddenBrand(e.target.value)}>
                              <option value="">Выберите бренд…</option>
                              {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <Btn className="primary" onClick={addHiddenBrand} style={{ alignSelf: 'flex-end' }}>{IC.plus} Скрыть</Btn>
                        </div>
                        <div>
                          {hiddenBrands.length === 0 && <p className="adm-hint">Скрытых брендов нет</p>}
                          {hiddenBrands.map(b => (
                            <div key={b} className="adm-item-row">
                              <div className="adm-item-label"><strong>{b}</strong></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Tag color="rose">скрыт</Tag>
                                <div className="adm-item-actions">
                                  <button className="adm-icon-mini danger" onClick={() => removeHiddenBrand(b)}>{IC.trash}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <CardHead title="Скрытые модели">
                        <div className="adm-spacer" />
                        <Tag color="amber">{hiddenModels.length}</Tag>
                      </CardHead>
                      <div className="adm-card-body">
                        <div className="adm-row-inputs-1a">
                          <div className="adm-field">
                            <label className="adm-label">Модель</label>
                            <input className="adm-input" placeholder="напр. CT2545" value={newHiddenModel} onChange={e => setNewHiddenModel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHiddenModel()} />
                          </div>
                          <Btn className="primary" onClick={addHiddenModel} style={{ alignSelf: 'flex-end' }}>{IC.plus} Скрыть</Btn>
                        </div>
                        <div>
                          {hiddenModels.length === 0 && <p className="adm-hint">Скрытых моделей нет</p>}
                          {hiddenModels.map(m => (
                            <div key={m} className="adm-item-row">
                              <div className="adm-item-label"><strong>{m}</strong></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Tag color="amber">скрыта</Tag>
                                <div className="adm-item-actions">
                                  <button className="adm-icon-mini danger" onClick={() => removeHiddenModel(m)}>{IC.trash}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </>
            )}

            {/* ===== PARSER ===== */}
            {tab === 'parser' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Парсер изображений</h1>
                    <div className="adm-page-sub">Скачивает изображения товаров с портала поставщика.</div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn className="danger" onClick={stopPortalParser} disabled={!portalParserStatus?.running || parserAction === 'stop'}>{IC.stop} Остановить</Btn>
                    <Btn onClick={clearParserCache} disabled={parserAction === 'clear'}>{IC.refresh} Очистить кэш</Btn>
                    <Btn className="primary" onClick={startPortalParser} disabled={parserAction === 'portal' || portalParserStatus?.running}>{IC.play} {parserAction === 'portal' ? 'Запуск…' : 'Запустить портал'}</Btn>
                  </div>
                </div>

                <div className="adm-grid-3">
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card>
                      <CardHead title={<>Парсер портала {portalParserStatus?.running && <Tag color="mint">работает</Tag>}</>}>
                        <div className="adm-spacer" />
                        {portalParserStatus?.running && <Pill type="live">live</Pill>}
                      </CardHead>
                      <div className="adm-card-body">
                        {portalParserStatus == null ? <Loading /> : portalParserStatus.error ? (
                          <p className="adm-error">{portalParserStatus.error}</p>
                        ) : (
                          <>
                            <div className="adm-minitiles">
                              <div className="adm-minitile"><div className="k">Статус</div><div className="v" style={{ fontSize: 14 }}>{portalParserStatus.running ? '▶ Работает' : '⏸ Остановлен'}</div></div>
                              {portalParserStatus.started_at && <div className="adm-minitile"><div className="k">Запущен</div><div className="v" style={{ fontSize: 12 }}>{formatDateTime(portalParserStatus.started_at)}</div></div>}
                              <div className="adm-minitile"><div className="k">Кэш</div><div className="v" style={{ fontSize: 14 }}>{parserStats?.total_images ?? '…'}</div></div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                              <span className="adm-hint">Лог действий</span>
                              <button className={`adm-btn sm${logScrollPaused ? ' primary' : ''}`} onClick={() => setLogScrollPaused(v => !v)}>
                                {logScrollPaused ? '▶ Авто-прокрутка' : '⏸ Пауза'}
                              </button>
                            </div>
                            <div className="adm-log" ref={portalLogRef}>
                              {portalParserLogs.length
                                ? portalParserLogs.map((line, i) => (
                                  <span key={i} className={colorizeLog(line)}>{line}{'\n'}</span>
                                ))
                                : <span className="adm-hint">Нет записей. Запустите парсер.</span>}
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card>
                      <CardHead title="Парсер изображений" />
                      <div className="adm-card-body">
                        <div className="adm-field">
                          <label className="adm-label">Страниц за запуск</label>
                          <input className="adm-input" type="number" min="1" max="100" value={parserMaxPages} onChange={e => setParserMaxPages(Math.max(1, parseInt(e.target.value) || 1))} />
                        </div>
                        <Btn className="primary" onClick={startParser} disabled={parserAction === 'start'} style={{ width: '100%', justifyContent: 'center' }}>
                          {IC.play} {parserAction === 'start' ? 'Запуск…' : 'Запустить парсинг изображений'}
                        </Btn>
                        {parserStatus && !parserStatus.error && (
                          <ul className="adm-status-list">
                            <li className="adm-status-row"><span className="adm-status-k">Статус</span><span className="adm-status-v"><Tag color={parserStatus.running ? 'mint' : ''}>{parserStatus.running ? 'работает' : 'остановлен'}</Tag></span></li>
                            <li className="adm-status-row"><span className="adm-status-k">Последний запуск</span><span className="adm-status-v">{formatDateTime(parserStatus.last_run)}</span></li>
                          </ul>
                        )}
                      </div>
                    </Card>

                    <Card>
                      <CardHead title="Статистика изображений" />
                      <div className="adm-card-body">
                        {parserStats ? (
                          <ul className="adm-status-list">
                            <li className="adm-status-row"><span className="adm-status-k">Товаров с фото</span><span className="adm-status-v">{parserStats.total_products ?? 0}</span></li>
                            <li className="adm-status-row"><span className="adm-status-k">Всего изображений</span><span className="adm-status-v">{parserStats.total_images ?? 0}</span></li>
                          </ul>
                        ) : <Loading />}
                      </div>
                    </Card>
                  </div>
                </div>
              </>
            )}

            {/* ===== PORTAL ===== */}
            {tab === 'portal' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Портал — сверка с portal_export</h1>
                    <div className="adm-page-sub">Модели из B2B, для которых не создана папка в <code className="adm-code">portal_export/</code></div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn onClick={loadPortalMismatch}>{IC.refresh} Пересканировать</Btn>
                    <Btn className="primary" onClick={startPortalParserMissing} disabled={!portalMismatch?.missing_count || parserAction === 'missing'}>
                      {IC.play} {parserAction === 'missing' ? 'Запуск…' : 'Создать недостающие'}
                    </Btn>
                  </div>
                </div>

                {portalMismatch && !portalMismatch.error && (
                  <div className="adm-kpi-grid-3">
                    <Kpi label="Всего в B2B" value={portalMismatch.total_products?.toLocaleString('ru')} delta="товаров" icon="pkg" />
                    <Kpi label="С папкой" value={(portalMismatch.total_products - portalMismatch.missing_count)?.toLocaleString('ru')} delta={`${portalMismatch.total_products ? Math.round(((portalMismatch.total_products - portalMismatch.missing_count) / portalMismatch.total_products) * 100) : 0}% покрытия`} icon="check" color="mint" />
                    <Kpi label="Без папки" value={portalMismatch.missing_count} delta="требует внимания" deltaDown={portalMismatch.missing_count > 0} icon="alert" color={portalMismatch.missing_count > 0 ? 'rose' : ''} />
                  </div>
                )}

                <div className="adm-table-wrap">
                  <div className="adm-table-toolbar">
                    <input className="adm-input" placeholder="Поиск по модели, названию, бренду…" value={portalSearch} onChange={e => setPortalSearch(e.target.value)} />
                    {portalSearch && <Btn className="sm" onClick={() => setPortalSearch('')}>✕ Сбросить</Btn>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {portalSearch && <Tag>найдено {portalMissingFiltered.length}</Tag>}
                    </div>
                  </div>
                  {portalLoading ? <Loading /> : portalMismatch?.error ? (
                    <div style={{ padding: 20 }}><p className="adm-error">{portalMismatch.error}</p></div>
                  ) : (
                    <table className="adm-dt">
                      <thead><tr><th>Модель</th><th>Название</th><th>Бренд</th><th>Ожидаемая папка</th></tr></thead>
                      <tbody>
                        {portalMissingFiltered.slice(0, 50).map((row, i) => (
                          <tr key={row.model + i}>
                            <td className="mono">{row.model}</td>
                            <td>{row.name || '—'}</td>
                            <td className="muted">{row.brand || '—'}</td>
                            <td className="mono muted">{row.expected_folder || row.clean_id || '—'}</td>
                          </tr>
                        ))}
                        {portalMissingFiltered.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }}><span className="adm-hint">{portalSearch ? 'Ничего не найдено' : 'Недостающих папок нет'}</span></td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {portalMissingFiltered.length > 50 && (
                    <div className="adm-card-foot">Показано 50 из {portalMissingFiltered.length}</div>
                  )}
                </div>
              </>
            )}

            {/* ===== ENRICHMENT ===== */}
            {tab === 'enrichment' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Обогащение каталога</h1>
                    <div className="adm-page-sub">Дозаполняет описания и характеристики из <code className="adm-code">complex.com.kz</code>. Только пустые поля.</div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn className="danger" onClick={stopEnrichment} disabled={!enrichmentStatus?.running || enrichmentAction === 'stop'}>{IC.stop} Остановить</Btn>
                    <Btn onClick={() => startEnrichment(true)} disabled={!!enrichmentStatus?.running || enrichmentAction === 'start'}>{IC.refresh} Force перезапуск</Btn>
                    <Btn className="primary" onClick={() => startEnrichment(false)} disabled={!!enrichmentStatus?.running || enrichmentAction === 'start'}>{IC.play} {enrichmentAction === 'start' ? 'Запуск…' : 'Запустить'}</Btn>
                  </div>
                </div>

                {enrichmentStatus && !enrichmentStatus.error && (
                  <div className="adm-kpi-grid-3">
                    <Kpi label="Очередь" value={enrichmentStatus.total ?? '—'} delta="товаров без описания" bar={enrichmentStatus.total ? 34 : 0} icon="list" />
                    <Kpi label="Обогащено" value={enrichmentStatus.enriched ?? 0} delta={`+${enrichmentStatus.enriched ?? 0} описаний`} bar={enrichmentStatus.total ? Math.round((enrichmentStatus.enriched / enrichmentStatus.total) * 100) : 0} icon="sparkle" color="mint" />
                    <Kpi label="Ошибок" value={enrichmentStatus.failed ?? 0} delta="не найдены на портале" deltaDown icon="alert" color={enrichmentStatus.failed > 0 ? 'rose' : ''} />
                  </div>
                )}

                <div className="adm-grid-3-2">
                  <Card>
                    <CardHead title="Обогащение в реальном времени">
                      <div className="adm-spacer" />
                      {enrichmentStatus?.running && <Pill type="live">работает</Pill>}
                    </CardHead>
                    <div className="adm-card-body">
                      {enrichmentStatus == null ? <Loading /> : enrichmentStatus.error ? (
                        <p className="adm-error">{enrichmentStatus.error}</p>
                      ) : (
                        <>
                          {enrichmentStatus.total > 0 && (
                            <div className="adm-progress">
                              <div className="adm-progress-ph">
                                <span>Обработано</span>
                                <span className="v">{enrichmentStatus.enriched + (enrichmentStatus.failed || 0)} / {enrichmentStatus.total} · {Math.round(((enrichmentStatus.enriched + (enrichmentStatus.failed || 0)) / enrichmentStatus.total) * 100)}%</span>
                              </div>
                              <div className="adm-progress-track">
                                <div className="adm-progress-fill" style={{ width: `${Math.round(((enrichmentStatus.enriched + (enrichmentStatus.failed || 0)) / enrichmentStatus.total) * 100)}%` }} />
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="adm-hint">Лог обогащения</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Btn className={`sm${enrichmentLogPaused ? ' primary' : ''}`} onClick={() => setEnrichmentLogPaused(v => !v)}>{enrichmentLogPaused ? '▶ Авто' : '⏸ Пауза'}</Btn>
                              <Btn className="sm" onClick={loadEnrichmentLogs}>{IC.refresh}</Btn>
                            </div>
                          </div>
                          <div className="adm-log" ref={enrichLogRef}>
                            {enrichmentLogs.length
                              ? enrichmentLogs.map((line, i) => (
                                <span key={i} className={colorizeLog(line)}>{line}{'\n'}</span>
                              ))
                              : <span className="adm-hint">Нет записей. Запустите обогащение.</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <CardHead title="Источники" />
                    <div className="adm-card-body">
                      <div className="adm-sources">
                        <label className="adm-switch on"><span>complex.com.kz</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch on"><span>akuvox.com</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch"><span>schneider-electric.com</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch"><span>dahuasecurity.com</span><span className="adm-switch-track" /></label>
                      </div>
                      <div style={{ height: 1, background: 'var(--adm-line)', margin: '8px 0' }} />
                      <div className="adm-label" style={{ marginBottom: 8 }}>Поля для обогащения</div>
                      <div className="adm-sources">
                        <label className="adm-switch on"><span>Описание (HTML)</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch on"><span>Характеристики</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch on"><span>Габариты / вес</span><span className="adm-switch-track" /></label>
                        <label className="adm-switch"><span>Гарантия и сертификаты</span><span className="adm-switch-track" /></label>
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* ===== AUDIT ===== */}
            {tab === 'audit' && (
              <>
                <div className="adm-page-head">
                  <div>
                    <h1 className="adm-page-title">Журнал изменений</h1>
                    <div className="adm-page-sub">Все действия администраторов и системных задач. Последние {auditEntries.length} записей.</div>
                  </div>
                  <div className="adm-page-actions">
                    <Btn onClick={loadAudit}>{IC.refresh} Обновить</Btn>
                  </div>
                </div>

                <div className="adm-kpi-grid">
                  <Kpi label="Записей всего" value={auditEntries.length} delta="загружено" bar={100} icon="list" />
                  <Kpi label="За сегодня" value={auditEntries.filter(e => { const d = new Date(typeof e.timestamp === 'number' ? e.timestamp * 1000 : e.timestamp); return d.toDateString() === new Date().toDateString(); }).length} delta="записей" bar={50} icon="check" color="mint" />
                  <Kpi label="Изменения цен" value={auditEntries.filter(e => (e.action || '').toLowerCase().includes('цен') || (e.action || '').toLowerCase().includes('price')).length} delta="в журнале" bar={30} icon="price" color="amber" />
                  <Kpi label="Удалений" value={auditEntries.filter(e => (e.action || '').toLowerCase().includes('удал') || (e.action || '').toLowerCase().includes('delete')).length} delta="в журнале" bar={8} icon="trash" color="rose" />
                </div>

                <div className="adm-table-wrap">
                  {auditLoading ? <Loading /> : auditEntries.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center' }}><p className="adm-hint">Записей пока нет.</p></div>
                  ) : (
                    <table className="adm-dt">
                      <thead><tr><th>Время</th><th>Действие</th><th>Объект</th><th>Детали</th><th>IP</th></tr></thead>
                      <tbody>
                        {auditEntries.map((e, i) => (
                          <tr key={`${e.timestamp}-${i}`}>
                            <td className="mono muted">{formatDateTime(e.timestamp)}</td>
                            <td>
                              <Tag color={
                                (e.action || '').toLowerCase().includes('удал') || (e.action || '').toLowerCase().includes('скры') ? 'rose'
                                : (e.action || '').toLowerCase().includes('уста') || (e.action || '').toLowerCase().includes('добав') ? 'mint'
                                : (e.action || '').toLowerCase().includes('изм') ? 'amber'
                                : ''
                              }>{e.action}</Tag>
                            </td>
                            <td className="mono">{e.target || '—'}</td>
                            <td className="muted">{e.details || '—'}</td>
                            <td className="mono muted">{e.ip || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---- Toast ---- */}
      <AnimatePresence>
        {priceMessage && (
          <motion.div
            key="toast"
            className={`adm-toast${priceMessage.type === 'success' ? ' success' : priceMessage.type === 'error' ? ' error' : ''}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {priceMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Confirm Modal ---- */}
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
    </div>
  );
}
