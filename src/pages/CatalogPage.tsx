import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCatalogUrl } from '@/shared/utils/catalogUrl';
import { useCart } from '@/shared/context/CartContext';
import styles from './CatalogPage.module.css';

export function CatalogPage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const refreshRef = useRef(refreshCart);
  refreshRef.current = refreshCart;

  const baseUrl = getCatalogUrl().replace(/\/$/, '');
  const normalized = pathname.replace(/^\/catalog\/?/, '/').replace(/^\/?/, '/');
  const embeddedSearch = search ? `${search}&embedded=1` : '?embedded=1';
  const iframeSrc = `${baseUrl}${normalized === '/' ? '' : normalized}${embeddedSearch}`;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type } = event.data || {};
      if (type === 'CATALOG_CART_UPDATE') {
        void refreshRef.current();
      } else if (type === 'CATALOG_OPEN_CART') {
        void refreshRef.current();
        // Открываем CartPanel в Layout через кастомное событие
        window.dispatchEvent(new CustomEvent('catalog-open-cart'));
      } else if (type === 'CATALOG_GOTO_CHECKOUT') {
        navigate('/catalog/checkout');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  return (
    <div className={styles.wrap}>
      <iframe
        src={iframeSrc}
        className={styles.frame}
        title="Каталог продукции"
        allow="clipboard-write"
      />
    </div>
  );
}
