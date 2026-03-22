/**
 * Vite `base` aware URL helpers.
 *
 * In production the catalog is usually served under `/catalog/` (via Nginx),
 * so API routes must be requested as `/catalog/products`, `/catalog/api/...`.
 *
 * Vite exposes the resolved base as `import.meta.env.BASE_URL` (always ends with `/`).
 */
export function getBaseUrl() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  if (typeof base !== 'string' || !base.trim()) return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Prefixes a path with the app base URL.
 *
 * - Keeps absolute URLs intact (`http(s)://`, `data:`).
 * - Accepts both `/api/...` and `api/...` forms.
 */
export function withBaseUrl(path) {
  if (path == null) return '';
  const s = String(path);
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:')) return s;

  const base = getBaseUrl();
  const tail = s.replace(/^\/+/, '');
  return `${base}${tail}`;
}

