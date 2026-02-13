import { useState, useEffect, useRef } from 'react';

const CART_KEY = 'b2b_cart';
const CART_UPDATE_EVENT = 'cart-updated';

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

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    lastCartStrRef.current = JSON.stringify(cart);
    window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: cart }));
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
    setCartState(prev => {
      const existing = prev.find(i => (i.model || '').trim() === model);
      if (existing) {
        return prev.map(i => 
          i.model === model 
            ? { ...i, quantity: (i.quantity || 1) + qty }
            : i
        );
      }
      return [...prev, {
        model,
        name: (product.name || '').trim() || model,
        brand: (product.brand || '').trim() || '',
        price: product.final_price != null && !isNaN(product.final_price) && Number(product.final_price) > 0
          ? Number(product.final_price) : null,
        quantity: qty,
      }];
    });
  };

  const removeFromCart = (model) => {
    setCartState(prev => prev.filter(i => (i.model || '').trim() !== (model || '').trim()));
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
  };

  const syncCart = () => {
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
