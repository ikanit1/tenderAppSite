import { useState, useEffect, useCallback } from 'react';
import { withBaseUrl } from '../utils/baseUrl';

const DEFAULT_LIMIT = 24;

/**
 * Загружает товары с бэкенд-фильтрацией (brand, search, category, limit, offset).
 * @param {Object} params - { search, brand, category, page }
 * @returns { products, loading, error, brands, total, limit, reload }
 */
export function useProducts(params = {}) {
  const { search = '', brand = '', category = '', page = 1 } = params;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const q = new URLSearchParams();
      if (search && search.trim()) q.set('search', search.trim());
      if (brand && brand.trim()) q.set('brand', brand.trim());
      if (category && category.trim()) q.set('category', category.trim());
      q.set('limit', String(limit));
      q.set('offset', String(offset));
      const url = `${withBaseUrl('/products')}?${q.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setProducts(data.products || []);
      setTotal(data.total ?? data.products?.length ?? 0);
      if (Array.isArray(data.brands)) {
        setBrands(data.brands);
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, brand, category, page, limit, offset]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Периодическое обновление (каждые 10 мин)
  useEffect(() => {
    const interval = setInterval(loadProducts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadProducts]);

  return {
    products,
    loading,
    error,
    brands,
    total: total ?? 0,
    limit,
    page,
    reload: loadProducts,
  };
}
