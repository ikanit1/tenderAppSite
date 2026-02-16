const CART_COOKIE_NAME = 'b2b_cart_data';
const MAX_COOKIE_LENGTH = 3000;

function getCookieOpts() {
  const maxAge = 'max-age=604800'; // 7 days
  const sameSite = 'SameSite=Lax';
  const path = 'path=/';

  if (typeof window === 'undefined') {
    return `${path}; ${maxAge}; ${sameSite}`;
  }

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const domainPart = isLocal ? 'domain=localhost; ' : '';
  const securePart = window.location.protocol === 'https:' ? 'Secure; ' : '';

  return `${path}; ${domainPart}${maxAge}; ${sameSite}; ${securePart}`.trim();
}

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${getCookieOpts()}`;
}

/**
 * Записать корзину в cookie (domain=localhost для доступа с 5173 и 8001).
 * При превышении лимита очищает cookie ([]), чтобы не показывать устаревшие данные — источник правды тогда API.
 */
export function setCartCookie(items) {
  try {
    const str = JSON.stringify(items);
    if (str.length > MAX_COOKIE_LENGTH) {
      setCookie(CART_COOKIE_NAME, '[]');
      return;
    }
    setCookie(CART_COOKIE_NAME, str);
  } catch {
    // ignore
  }
}

/**
 * Прочитать корзину из cookie.
 */
export function getCartCookie() {
  try {
    const raw = getCookie(CART_COOKIE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => ({
      model: String(item.model ?? '').trim(),
      name: item.name != null ? String(item.name).trim() : undefined,
      brand: item.brand != null ? String(item.brand).trim() : undefined,
      price: item.price != null && !isNaN(Number(item.price)) ? Number(item.price) : null,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    })).filter((item) => item.model.length > 0);
  } catch {
    return null;
  }
}
