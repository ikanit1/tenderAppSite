import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { akuvoxSmartSystems, type AkuvoxProduct } from '@/shared/content/akuvoxSmartSystems';
import styles from './SmartMarquee.module.css';

interface SmartMarqueeProps {
  onProductClick?: (product: AkuvoxProduct) => void;
}

/**
 * Умная бегущая строка с товарами из smart-systems
 * - Показывает товары из всех категорий Akuvox
 * - Поддерживает pause on hover
 * - Quick view при клике
 * - Оптимизированная CSS анимация для плавной прокрутки
 */
const MOBILE_GRID_SIZE = 6;

export function SmartMarquee({ onProductClick }: SmartMarqueeProps) {
  const [isPaused, setIsPaused] = useState(false);
  const marqueeContentRef = useRef<HTMLDivElement>(null);

  // Собираем все товары из всех категорий
  const allProducts = useMemo(() => {
    return akuvoxSmartSystems.categories.flatMap(category => 
      category.products.map(product => ({
        ...product,
        categoryId: category.id,
      }))
    );
  }, []);

  // Формируем список товаров для отображения (перемешиваем и берем первые 12)
  const displayProducts = useMemo(() => {
    if (allProducts.length === 0) return [];

    // Функция для перемешивания массива (Fisher-Yates shuffle)
    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Перемешиваем и берем первые 12 товаров
    const shuffled = shuffleArray(allProducts);
    return shuffled.slice(0, 12).map(product => ({
      ...product,
      label: 'В наличии',
      reason: 'popular' as const,
    }));
  }, [allProducts]);

  // Обновляем CSS переменную для паузы анимации
  useEffect(() => {
    if (marqueeContentRef.current) {
      marqueeContentRef.current.style.setProperty('--animation-play-state', isPaused ? 'paused' : 'running');
    }
  }, [isPaused]);

  const handleProductClick = useCallback((product: AkuvoxProduct) => {
    if (onProductClick) {
      onProductClick(product);
    }
  }, [onProductClick]);

  const getImageUrl = (product: AkuvoxProduct): string | null => {
    if (product.image) {
      return product.image.startsWith('/') ? product.image : `/akuvox/${product.image}`;
    }
    return null;
  };

  const renderCard = (product: (typeof displayProducts)[number], index: number, copyId = '') => {
    const imageUrl = getImageUrl(product);
    const priceLabel = product.priceKzt
      ? new Intl.NumberFormat('ru-RU').format(Math.round(product.priceKzt)) + ' ₸'
      : 'по запросу';
    return (
      <motion.div
        key={`${product.model}-${index}${copyId}`}
        className={styles.marqueeCard}
        onClick={() => handleProductClick(product)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div className={styles.marqueeCardImage}>
          {imageUrl ? (
            <img src={imageUrl} alt={product.model} loading="lazy" />
          ) : (
            <div className={styles.marqueeCardPlaceholder}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 7h-4V5l-2-2H6L4 5v2H0v2h2v10a2 2 0 002 2h16a2 2 0 002-2V9h2V7zM6 5h8v2H6V5zm12 14H6V9h12v10z" fill="currentColor" opacity="0.3"/>
              </svg>
            </div>
          )}
        </div>
        <div className={styles.marqueeCardInfo}>
          <div className={styles.marqueeCardName} title={product.model}>
            {product.model}
          </div>
          <div className={styles.marqueeCardLabel}>{product.label}</div>
          <div className={styles.marqueeCardPrice}>{priceLabel}</div>
        </div>
      </motion.div>
    );
  };

  if (displayProducts.length === 0) {
    return null;
  }

  const header = (
    <div className={styles.marqueeHeader}>
      <div className={styles.marqueeTitle}>
        <svg className={styles.marqueeIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2l2.5 5.5L18 8.5l-4.5 4 1 6-4.5-2.5L10 18.5l-1-6-4.5-4 5.5-1L10 2z" fill="currentColor" opacity="0.9"/>
        </svg>
        <span className={styles.marqueeText}>Популярные товары</span>
      </div>
    </div>
  );

  const mobileProducts = displayProducts.slice(0, MOBILE_GRID_SIZE);

  return (
    <section className={styles.smartMarquee}>
      {header}
      {/* Мобильный вид: сетка, показывается только через CSS @media (max-width: 768px) */}
      <div className={styles.marqueeGridWrap}>
        <div className={styles.marqueeGrid}>
          {mobileProducts.map((product, index) => renderCard(product, index, 'm'))}
        </div>
      </div>
      {/* Десктоп: бегущая строка, скрывается на мобильных через CSS */}
      <div
        className={styles.marqueeDesktopWrap}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className={styles.marqueeContainer}>
          <div
            ref={marqueeContentRef}
            className={styles.marqueeContent}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {displayProducts.map((p, i) => renderCard(p, i, 'a'))}
            {displayProducts.map((p, i) => renderCard(p, i, 'b'))}
          </div>
        </div>
        <div className={styles.marqueeGradientLeft}></div>
        <div className={styles.marqueeGradientRight}></div>
      </div>
    </section>
  );
}
