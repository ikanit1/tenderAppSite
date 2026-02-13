import type { CartItem } from '@/shared/context/CartContext';
import { getCatalogUrl } from './catalogUrl';

const API_BASE_URL = getCatalogUrl();

/**
 * Получает корзину с сервера
 */
export async function getCartFromAPI(): Promise<CartItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      method: 'GET',
      credentials: 'include', // Важно для отправки cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cart: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching cart from API:', error);
    return [];
  }
}

/**
 * Сохраняет корзину на сервер
 */
export async function saveCartToAPI(items: CartItem[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save cart: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error saving cart to API:', error);
    return false;
  }
}

/**
 * Добавляет товар в корзину на сервере
 */
export async function addItemToAPI(
  item: CartItem,
  quantity: number = 1
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/items`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: {
          model: item.model,
          name: item.name,
          brand: item.brand,
          price: item.price,
        },
        quantity,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add item to cart: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error adding item to API cart:', error);
    return false;
  }
}

/**
 * Удаляет товар из корзины на сервере
 */
export async function removeItemFromAPI(model: string): Promise<boolean> {
  try {
    const encodedModel = encodeURIComponent(model);
    const response = await fetch(`${API_BASE_URL}/api/cart/items/${encodedModel}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to remove item from cart: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error removing item from API cart:', error);
    return false;
  }
}

/**
 * Очищает корзину на сервере
 */
export async function clearCartAPI(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear cart: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error clearing cart API:', error);
    return false;
  }
}
