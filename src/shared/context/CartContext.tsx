import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { getCartFromAPI, saveCartToAPI, addItemToAPI, removeItemFromAPI, clearCartAPI } from '@/shared/utils/cartApi';

const CART_KEY = 'b2b_cart';
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
  getCartModels: () => string[];
  totalCount: number;
  totalSum: number;
}

const CartContext = createContext<CartContextType | null>(null);

const loadCartFromStorage = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Ensure all items have required fields
    return Array.isArray(parsed) ? parsed.map((item: any) => ({
      model: String(item.model || '').trim(),
      name: item.name ? String(item.name).trim() : undefined,
      brand: item.brand ? String(item.brand).trim() : undefined,
      price: item.price != null && !isNaN(item.price) && Number(item.price) > 0 ? Number(item.price) : null,
      quantity: item.quantity && !isNaN(item.quantity) ? Math.max(1, Number(item.quantity)) : 1,
    })) : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const lastCartStrRef = useRef('');
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Функция для синхронизации корзины с API
  const syncCartWithAPI = useCallback(async () => {
    if (isSyncingRef.current) return;
    
    try {
      isSyncingRef.current = true;
      const apiCart = await getCartFromAPI();
      
      if (apiCart.length > 0) {
        // Объединяем локальную и API корзину
        // Приоритет у API корзины, но сохраняем локальные товары, которых нет в API
        const localCart = loadCartFromStorage();
        const mergedCart: CartItem[] = [];
        const seenModels = new Set<string>();
        
        // Сначала добавляем товары из API
        for (const apiItem of apiCart) {
          mergedCart.push(apiItem);
          seenModels.add(apiItem.model.trim().toLowerCase());
        }
        
        // Затем добавляем локальные товары, которых нет в API
        for (const localItem of localCart) {
          const modelKey = localItem.model.trim().toLowerCase();
          if (!seenModels.has(modelKey)) {
            mergedCart.push(localItem);
            seenModels.add(modelKey);
          }
        }
        
        // Обновляем состояние только если есть изменения
        const mergedStr = JSON.stringify(mergedCart);
        if (lastCartStrRef.current !== mergedStr) {
          setItems(mergedCart);
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

  // Save to localStorage and API on changes
  useEffect(() => {
    const cartStr = JSON.stringify(items);
    if (lastCartStrRef.current !== cartStr) {
      localStorage.setItem(CART_KEY, cartStr);
      lastCartStrRef.current = cartStr;
      window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: items }));
      // Сохраняем в API
      saveCartToAPIDebounced(items);
    }
  }, [items, saveCartToAPIDebounced]);

  // Listen for storage events (cross-tab sync) and custom events
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

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_KEY && e.newValue) {
        try {
          const newCart = JSON.parse(e.newValue) as CartItem[];
          setItems((prev) => {
            const str = JSON.stringify(newCart);
            if (lastCartStrRef.current === str) return prev;
            lastCartStrRef.current = str;
            return newCart;
          });
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
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

    // Сохраняем в API сразу
    addItemToAPI(newItem, quantity).catch((error) => {
      console.error('Error adding item to API:', error);
    });
  }, []);

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
