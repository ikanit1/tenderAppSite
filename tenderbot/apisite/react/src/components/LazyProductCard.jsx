import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import ProductCard from './ProductCard';

/**
 * Обертка для ProductCard с lazy loading
 * Рендерит карточку только когда она попадает в viewport
 */
export default function LazyProductCard({ product, onCardClick, delay = 0 }) {
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (hasIntersected && !shouldRender) {
      const timer = setTimeout(() => {
        setShouldRender(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [hasIntersected, delay, shouldRender]);

  return (
    <div ref={ref} style={{ minHeight: '400px' }}>
      <AnimatePresence mode="wait">
        {shouldRender ? (
          <motion.div
            key="card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ height: '100%' }}
          >
            <ProductCard
              product={product}
              onCardClick={onCardClick}
            />
          </motion.div>
        ) : (
          <motion.div
            key="skeleton"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="product-card-skeleton"
              animate={{ opacity: [0.5, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.2, repeatType: 'reverse' }}
            >
              <div className="skeleton-image"></div>
              <div className="skeleton-content">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line skeleton-subtitle"></div>
                <div className="skeleton-line skeleton-price"></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
