import { useState, useEffect, useRef } from 'react';
import { getCartFromAPI, saveCartToAPI, addItemToAPI, removeItemFromAPI, clearCartAPI } from '../utils/cartApi';
import { getCartCookie, setCartCookie } from '../utils/cartCookie';

const CART_UPDATE_EVENT = 'cart-updated';
const SYNC_INTERVAL_MS = 5000; // 5 секунд

/** Загрузка корзины из cookie (единственный клиентский источник) */
function loadCartFromCookie() {
  const cookieCart = getCartCookie();
  if (!cookieCart?.length) return [];
  return cookieCart.map((item) => ({
    model: String(item.model || '').trim(),
    name: item.name != null ? String(item.name).trim() : undefined,
    brand: item.brand != null ? String(item.brand).trim() : undefined,
    price: item.price != null && !isNaN(Number(item.price)) ? Number(item.price) : null,
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
  })).filter((item) => item.model.length > 0);
}

/** Начальное состояние: только из cookie */
function getInitialCart() {
  return loadCartFromCookie();
}

export function useCart() {
  const [cart, setCartState] = useState(getInitialCart);
  const lastCartStrRef = useRef('');
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef(null);

  // Синхронизация с API — всегда применяем ответ (единая корзина 5173, 8001, Checkout)
  const syncCartWithAPI = async () => {
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      const apiCart = await getCartFromAPI();
      const seenModels = new Set(apiCart.map((i) => (i.model || '').trim().toLowerCase()));
      const mergedCart = [...apiCart];
      for (const localItem of loadCartFromCookie()) {
        const key = (localItem.model || '').trim().toLowerCase();
        if (!seenModels.has(key)) {
          mergedCart.push(localItem);
          seenModels.add(key);
        }
      }
      const mergedStr = JSON.stringify(mergedCart);
      if (lastCartStrRef.current !== mergedStr) {
        setCartState(mergedCart);
        lastCartStrRef.current = mergedStr;
      }
    } catch (error) {
      console.error('Error syncing cart with API:', error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Сохранение корзины в API (с debounce)
  const saveCartToAPIDebounced = (cartItems) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await saveCartToAPI(cartItems);
      } catch (error) {
        console.error('Error saving cart to API:', error);
      }
    }, 300); // Debounce 300ms
  };

  // Загрузка корзины с API при монтировании
  useEffect(() => {
    syncCartWithAPI();
    
    // Периодическая синхронизация
    const syncInterval = setInterval(() => {
      syncCartWithAPI();
    }, SYNC_INTERVAL_MS);
    
    // Синхронизация при фокусе окна
    const handleFocus = () => {
      syncCartWithAPI();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    lastCartStrRef.current = JSON.stringify(cart);
    window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: cart }));
    saveCartToAPIDebounced(cart);
    setCartCookie(cart);
  }, [cart]);

  useEffect(() => {
    const handleCartUpdate = (e) => {
      const newCart = e.detail;
      setCartState(prev => {
        if (prev === newCart) return prev;
        if (prev.length !== newCart.length) {
          lastCartStrRef.current = JSON.stringify(newCart);
          return newCart;
        }
        const str = JSON.stringify(newCart);
        if (lastCartStrRef.current === str) return prev;
        lastCartStrRef.current = str;
        return newCart;
      });
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);

    // Перезагрузка корзины из cookie при фокусе окна (синхронизация 5173/8001)
    const handleFocus = () => {
      const loadedCart = loadCartFromCookie();
      const loadedStr = JSON.stringify(loadedCart);
      if (lastCartStrRef.current !== loadedStr) {
        setCartState(loadedCart);
        lastCartStrRef.current = loadedStr;
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const addToCart = (product, qty = 1) => {
    if (!product?.model) return;
    const model = String(product.model).trim();
    const newItem = {
      model,
      name: (product.name || '').trim() || model,
      brand: (product.brand || '').trim() || '',
      price: product.final_price != null && !isNaN(product.final_price) && Number(product.final_price) > 0
        ? Number(product.final_price) : null,
      quantity: qty,
    };
    
    setCartState(prev => {
      const existing = prev.find(i => (i.model || '').trim() === model);
      if (existing) {
        return prev.map(i => 
          i.model === model 
            ? { ...i, quantity: (i.quantity || 1) + qty }
            : i
        );
      }
      return [...prev, newItem];
    });
    
    // Сохраняем в API сразу
    addItemToAPI(newItem, qty).catch((error) => {
      console.error('Error adding item to API:', error);
    });
  };

  const removeFromCart = (model) => {
    setCartState(prev => prev.filter(i => (i.model || '').trim() !== (model || '').trim()));
    // Удаляем из API
    removeItemFromAPI(model).catch((error) => {
      console.error('Error removing item from API:', error);
    });
  };

  const updateQty = (model, delta) => {
    setCartState(prev => prev.map(i => 
      (i.model || '').trim() === (model || '').trim()
        ? { ...i, quantity: Math.max(1, (i.quantity || 1) + delta) }
        : i
    ));
  };

  const clearCart = () => {
    setCartState([]);
    clearCartAPI().catch((error) => {
      console.error('Error clearing API cart:', error);
    });
  };

  /** Заменить корзину внешними данными (fallback для ?cart= в URL) */
  const setCartFromExternal = (newCart) => {
    const arr = Array.isArray(newCart) ? newCart : [];
    const normalized = arr.map((item) => ({
      model: String(item.model || '').trim(),
      name: (item.name || '').trim() || String(item.model || '').trim(),
      brand: (item.brand || '').trim() || '',
      price: item.price != null && !isNaN(item.price) ? Number(item.price) : (item.final_price != null && !isNaN(item.final_price) ? Number(item.final_price) : null),
      quantity: item.quantity != null && !isNaN(item.quantity) ? Math.max(1, Number(item.quantity)) : 1,
    })).filter((item) => item.model);
    lastCartStrRef.current = JSON.stringify(normalized);
    setCartState(normalized);
    setCartCookie(normalized);
  };

  const syncCart = async () => {
    await syncCartWithAPI();
    const loadedCart = loadCartFromCookie();
    const loadedStr = JSON.stringify(loadedCart);
    if (lastCartStrRef.current !== loadedStr) {
      setCartState(loadedCart);
      lastCartStrRef.current = loadedStr;
    }
  };

  const totalCount = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const totalSum = cart.reduce((sum, i) => {
    const p = i.price != null && !isNaN(i.price) ? Number(i.price) : null;
    return sum + (p != null ? p * (i.quantity || 1) : 0);
  }, 0);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    setCartFromExternal,
    syncCart,
    totalCount,
    totalSum,
  };
}
