const FALLBACK_MAIN_SITE_URL = 'http://localhost:5173';

export function getMainSiteUrl() {
  const envUrl = import.meta.env?.VITE_MAIN_SITE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return FALLBACK_MAIN_SITE_URL;
}
