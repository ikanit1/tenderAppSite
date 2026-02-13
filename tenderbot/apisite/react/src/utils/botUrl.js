const FALLBACK_BOT_URL = 'https://t.me/tenderlbot';

export function getBotUrl() {
  const envUrl = import.meta.env?.VITE_BOT_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return FALLBACK_BOT_URL;
}
