/**
 * URL каталога: для production — относительный /catalog (тот же хост),
 * для dev — из .env или localhost:8001.
 */
export function getCatalogUrl(): string {
  const envUrl = import.meta.env?.VITE_CATALOG_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }

  // Safe production fallback: same host, proxied by Nginx.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0';
    if (!isLocal) return '/catalog';
  }

  return 'http://localhost:8001';
}
