/**
 * Получает URL каталога из переменных окружения
 * @returns URL каталога (по умолчанию http://localhost:8001)
 */
export function getCatalogUrl(): string {
  const envUrl = import.meta.env?.VITE_CATALOG_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return 'http://localhost:8001';
}
