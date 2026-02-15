import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { getCartFromAPI, saveCartToAPI, addItemToAPI, removeItemFromAPI, clearCartAPI } from '@/shared/utils/cartApi';
import { getCartCookie, setCartCookie } from '@/shared/utils/cartCookie';

const CART_UPDATE_EVENT = 'cart-updated';
const SYNC_INTERVAL_MS = 5000; // 5 секунд

export interface CartItem {
  model: string;
  name?: string;
  brand?: string;
  price?: number | null;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  cart: CartItem[]; // Alias for items for compatibility
  addToCart: (product: CartItem | { model: string; name?: string; brand?: string; price?: number | null } | string, quantity?: number) => void;
  removeFromCart: (model: string) => void;
  updateQuantity: (model: string, quantity: number) => void;
  updateQty: (model: string, delta: number) => void; // For compatibility with catalog
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  saveCartNow: (itemsToSave?: CartItem[]) => Promise<void>;
  getCartModels: () => string[];
  totalCount: number;
  totalSum: number;
}

const CartContext = createContext<CartContextType | null>(null);

/** Загрузка корзины из cookie (единственный клиентский источник) */
function loadCartFromCookie(): CartItem[] {
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
function getInitialCart(): CartItem[] {
  return loadCartFromCookie();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getInitialCart);
  const lastCartStrRef = useRef('');
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Синхронизация с API — общая корзина для localhost:5173/smart-systems и localhost:8001
  const syncCartWithAPI = useCallback(async () => {
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      const apiCart = await getCartFromAPI();
      const seenModels = new Set(apiCart.map((i) => i.model.trim().toLowerCase()));
      const mergedCart = [...apiCart];
      // Подмешиваем позиции из cookie, которых ещё нет в API
      for (const localItem of loadCartFromCookie()) {
        const key = (localItem.model || '').trim().toLowerCase();
        if (!seenModels.has(key)) {
          mergedCart.push(localItem);
          seenModels.add(key);
        }
      }
      const mergedStr = JSON.stringify(mergedCart);
      if (lastCartStrRef.current !== mergedStr) {
        setItems(mergedCart);
        lastCartStrRef.current = mergedStr;
      }
    } catch (error) {
      console.error('Error syncing cart with API:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Сохранение корзины в API (с debounce)
  const saveCartToAPIDebounced = useCallback((cartItems: CartItem[]) => {
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
  }, []);

  // Сохранить корзину в API сразу (перед переходом на Checkout); можно передать актуальный список
  const saveCartNow = useCallback(async (itemsToSave?: CartItem[]) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    const payload = itemsToSave ?? items;
    const ok = await saveCartToAPI(payload);
    if (!ok) throw new Error('Failed to save cart to API');
  }, [items]);

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
  }, [syncCartWithAPI]);

  // Save to API и cookie (domain=localhost для 5173/8001)
  useEffect(() => {
    const cartStr = JSON.stringify(items);
    if (lastCartStrRef.current !== cartStr) {
      lastCartStrRef.current = cartStr;
      window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: items }));
      saveCartToAPIDebounced(items);
      setCartCookie(items);
    }
  }, [items, saveCartToAPIDebounced]);

  // Слушаем кастомное событие обновления корзины (синхронизация внутри приложения)
  useEffect(() => {
    const handleCartUpdate = (e: CustomEvent) => {
      const newCart = e.detail as CartItem[];
      setItems((prev) => {
        if (prev === newCart) return prev;
        const str = JSON.stringify(newCart);
        if (lastCartStrRef.current === str) return prev;
        lastCartStrRef.current = str;
        return newCart;
      });
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate as EventListener);
    };
  }, []);

  const addToCart = useCallback((
    product: CartItem | { model: string; name?: string; brand?: string; price?: number | null } | string,
    quantity: number = 1
  ) => {
    let model: string;
    let name: string | undefined;
    let brand: string | undefined;
    let price: number | null | undefined;

    if (typeof product === 'string') {
      // Backward compatibility: just model string
      model = product.trim();
      name = undefined;
      brand = undefined;
      price = undefined;
    } else {
      model = String(product.model || '').trim();
      name = product.name ? String(product.name).trim() : undefined;
      brand = product.brand ? String(product.brand).trim() : undefined;
      price = product.price != null && !isNaN(product.price) && Number(product.price) > 0
        ? Number(product.price)
        : null;
    }

    if (!model) return;

    const newItem: CartItem = {
      model,
      name: name || model,
      brand,
      price,
      quantity,
    };

    setItems((prev) => {
      const existing = prev.find((item) => item.model === model);
      if (existing) {
        return prev.map((item) =>
          item.model === model
            ? { ...item, quantity: (item.quantity || 1) + quantity }
            : item
        );
      }
      return [...prev, newItem];
    });

    // Сохраняем в API сразу, после успеха синхронизируем с сервером
    addItemToAPI(newItem, quantity)
      .then((ok) => {
        if (ok) void syncCartWithAPI();
      })
      .catch((error) => {
        console.error('Error adding item to API:', error);
      });
  }, [syncCartWithAPI]);

  const removeFromCart = useCallback((model: string) => {
    setItems((prev) => prev.filter((item) => item.model.trim() !== model.trim()));
    // Удаляем из API
    removeItemFromAPI(model).catch((error) => {
      console.error('Error removing item from API:', error);
    });
  }, []);

  const updateQuantity = useCallback((model: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(model);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.model.trim() === model.trim() ? { ...item, quantity } : item))
    );
  }, [removeFromCart]);

  const updateQty = useCallback((model: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.model.trim() === model.trim()
          ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    // Очищаем API корзину
    clearCartAPI().catch((error) => {
      console.error('Error clearing API cart:', error);
    });
  }, []);

  const getCartModels = useCallback(() => {
    return items.map((item) => item.model);
  }, [items]);

  const totalCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalSum = items.reduce((sum, item) => {
    const p = item.price != null && !isNaN(item.price) ? Number(item.price) : null;
    return sum + (p != null ? p * (item.quantity || 1) : 0);
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cart: items, // Alias for compatibility
        addToCart,
        removeFromCart,
        updateQuantity,
        updateQty,
        clearCart,
        refreshCart: syncCartWithAPI,
        saveCartNow,
        getCartModels,
        totalCount,
        totalSum,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
