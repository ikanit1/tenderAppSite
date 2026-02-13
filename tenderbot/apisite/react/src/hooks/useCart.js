import { useState, useEffect, useRef } from 'react';
import { getCartFromAPI, saveCartToAPI, addItemToAPI, removeItemFromAPI, clearCartAPI } from '../utils/cartApi';

const CART_KEY = 'b2b_cart';
const CART_UPDATE_EVENT = 'cart-updated';
const SYNC_INTERVAL_MS = 5000; // 5 секунд

const loadCartFromStorage = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export function useCart() {
  const [cart, setCartState] = useState(loadCartFromStorage);
  const lastCartStrRef = useRef('');
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef(null);

  // Функция для синхронизации корзины с API
  const syncCartWithAPI = async () => {
    if (isSyncingRef.current) return;
    
    try {
      isSyncingRef.current = true;
      const apiCart = await getCartFromAPI();
      
      if (apiCart.length > 0) {
        // Объединяем локальную и API корзину
        const localCart = loadCartFromStorage();
        const mergedCart = [];
        const seenModels = new Set();
        
        // Сначала добавляем товары из API
        for (const apiItem of apiCart) {
          mergedCart.push(apiItem);
          seenModels.add((apiItem.model || '').trim().toLowerCase());
        }
        
        // Затем добавляем локальные товары, которых нет в API
        for (const localItem of localCart) {
          const modelKey = (localItem.model || '').trim().toLowerCase();
          if (!seenModels.has(modelKey)) {
            mergedCart.push(localItem);
            seenModels.add(modelKey);
          }
        }
        
        // Обновляем состояние только если есть изменения
        const mergedStr = JSON.stringify(mergedCart);
        if (lastCartStrRef.current !== mergedStr) {
          setCartState(mergedCart);
          localStorage.setItem(CART_KEY, mergedStr);
          lastCartStrRef.current = mergedStr;
        }
      }
    } catch (error) {
      console.error('Error syncing cart with API:', error);
      // Fallback на localStorage при ошибке
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
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    lastCartStrRef.current = JSON.stringify(cart);
    window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: cart }));
    // Сохраняем в API
    saveCartToAPIDebounced(cart);
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

    // Слушаем кастомное событие обновления корзины
    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    
    // Слушаем события storage (для синхронизации между вкладками)
    const handleStorageChange = (e) => {
      if (e.key === CART_KEY && e.newValue) {
        try {
          const newCart = JSON.parse(e.newValue);
          setCartState(newCart);
        } catch {
          // Игнорируем ошибки парсинга
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Перезагрузка корзины при фокусе окна (для синхронизации между разными доменами)
    const handleFocus = () => {
      const loadedCart = loadCartFromStorage();
      const loadedStr = JSON.stringify(loadedCart);
      if (lastCartStrRef.current !== loadedStr) {
        setCartState(loadedCart);
        lastCartStrRef.current = loadedStr;
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
      window.removeEventListener('storage', handleStorageChange);
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
    // Очищаем API корзину
    clearCartAPI().catch((error) => {
      console.error('Error clearing API cart:', error);
    });
  };

  const syncCart = async () => {
    // Синхронизируем с API
    await syncCartWithAPI();
    // Также синхронизируем с localStorage
    const loadedCart = loadCartFromStorage();
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
    syncCart,
    totalCount,
    totalSum,
  };
}
