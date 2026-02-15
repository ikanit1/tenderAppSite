const FALLBACK_MAIN_SITE_URL = 'http://localhost:5173';

/**
 * URL главного сайта: при открытии каталога с localhost:8001 — ссылки ведут на 5173;
 * на проде (тот же хост под /catalog/) — относительный путь для единой навигации.
 */
export function getMainSiteUrl() {
  if (typeof window === 'undefined') return import.meta.env?.VITE_MAIN_SITE_URL?.trim() || FALLBACK_MAIN_SITE_URL;
  if (window.location.port === '8001' && window.location.hostname === 'localhost') {
    return 'http://localhost:5173';
  }
  const envUrl = import.meta.env?.VITE_MAIN_SITE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return FALLBACK_MAIN_SITE_URL;
}
