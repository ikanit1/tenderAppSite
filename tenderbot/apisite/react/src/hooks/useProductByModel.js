import { useState, useEffect, useCallback } from 'react';
import { withBaseUrl } from '../utils/baseUrl';

/**
 * Загружает один товар по артикулу (model).
 * @param {string|null} model - артикул товара (из ?model= в URL)
 * @returns { product, loading, error, reload }
 */
export function useProductByModel(model) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProduct = useCallback(async () => {
    if (!model || !String(model).trim()) {
      setProduct(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const encoded = encodeURIComponent(String(model).trim());
      const url = withBaseUrl(`/products/${encoded}`);
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Товар не найден');
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  return {
    product,
    loading,
    error,
    reload: loadProduct,
  };
}
