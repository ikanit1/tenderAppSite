import { useState, useEffect } from 'react';
import { withBaseUrl } from '../utils/baseUrl';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    loadProducts();
    const interval = setInterval(loadProducts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(withBaseUrl('/products'));
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setProducts(data.products || []);
      
      const uniqueBrands = [...new Set((data.products || [])
        .map(p => p.brand)
        .filter(Boolean))].sort();
      setBrands(uniqueBrands);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, brands, reload: loadProducts };
}
