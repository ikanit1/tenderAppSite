import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { generateImageUrl } from '../utils/imageUrl';
import { CATEGORY_KEYWORDS } from './Filters';

/**
 * Умная бегущая строка с товарами
 * - Показывает товары кластерами: 2 камеры, 1 монитор, 1 видеорегистратор и т.д.
 * - Поддерживает pause on hover
 * - Quick view при клике
 * - Оптимизированная CSS анимация для плавной прокрутки
 */
export default function SmartMarquee({ products, onProductClick }) {
  const [isPaused, setIsPaused] = useState(false);
  const marqueeContentRef = useRef(null);

  // Категории для кластеризации
  const CLUSTER_CATEGORIES = ['ip-cameras', 'monitors', 'ip-recorders'];

  // Фильтруем товары из нужных категорий
  const filteredProductsByCategory = useMemo(() => {
    if (!products || products.length === 0) return {};

    const byCategory = {
      'ip-cameras': [],
      'monitors': [],
      'ip-recorders': []
    };
    const productTextMap = new Map();

    products.forEach(product => {
      // Кэшируем текст товара
      if (!productTextMap.has(product.model)) {
        productTextMap.set(product.model, `${product.name} ${product.model} ${product.brand}`.toLowerCase());
      }
      const productText = productTextMap.get(product.model);

      // Проверяем каждую категорию
      for (const category of CLUSTER_CATEGORIES) {
        const categoryRules = CATEGORY_KEYWORDS[category];
        if (!categoryRules) continue;

        let matches = true;

        // ШАГ 1: Проверка исключений
        if (categoryRules.exclude && categoryRules.exclude.length > 0) {
          const hasExcluded = categoryRules.exclude.some(excludeWord => {
            const word = excludeWord.toLowerCase().trim();
            if (!word) return false;
            return productText.includes(word);
          });
          if (hasExcluded) {
            matches = false;
            continue;
          }
        }

        // ШАГ 2: Проверка обязательных слов
        if (matches && categoryRules.require && categoryRules.require.length > 0) {
          const hasRequired = categoryRules.require.some(requireWord => {
            const word = requireWord.toLowerCase().trim();
            if (!word) return false;
            return productText.includes(word);
          });
          if (!hasRequired) {
            matches = false;
            continue;
          }
        }

        // ШАГ 3: Проверка включений
        if (matches && categoryRules.include && categoryRules.include.length > 0) {
          const hasIncluded = categoryRules.include.some(includeWord => {
            const word = includeWord.toLowerCase().trim();
            if (!word) return false;
            return productText.includes(word);
          });
          if (hasIncluded) {
            byCategory[category].push({ ...product, category });
            break; // Товар уже добавлен, не проверяем другие категории
          }
        }
      }
    });

    return byCategory;
  }, [products]);

  // Формируем кластеры товаров по паттерну: 2 камеры, 1 монитор, 1 видеорегистратор
  const displayProducts = useMemo(() => {
    const byCategory = filteredProductsByCategory;
    
    // Проверяем наличие товаров
    if (!byCategory['ip-cameras']?.length && 
        !byCategory['monitors']?.length && 
        !byCategory['ip-recorders']?.length) {
      return [];
    }

    // Функция для перемешивания массива (Fisher-Yates shuffle)
    const shuffleArray = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Перемешиваем товары в каждой категории
    const shuffledCameras = shuffleArray(byCategory['ip-cameras'] || []);
    const shuffledMonitors = shuffleArray(byCategory['monitors'] || []);
    const shuffledRecorders = shuffleArray(byCategory['ip-recorders'] || []);

    // Функция для добавления меток товару
    const addLabels = (p) => {
      let reason = 'popular';
      let label = 'В наличии';
      
      if (p.discount > 0 && p.discount >= 10) {
        reason = 'discount';
        label = `Скидка ${p.discount.toFixed(0)}%`;
      } else if (p.quantity != null && p.quantity > 0 && p.quantity < 10) {
        reason = 'low-stock';
        label = `Осталось ${p.quantity} шт.`;
      }
      
      return { ...p, reason, label };
    };

    // Формируем кластеры по паттерну: 2 камеры, 1 монитор, 1 видеорегистратор
    const clusters = [];
    let cameraIndex = 0;
    let monitorIndex = 0;
    let recorderIndex = 0;

    // Создаем несколько циклов паттерна для достаточного количества товаров
    const cycles = Math.max(5, Math.ceil(20 / 4)); // 4 товара на цикл (2+1+1)

    for (let cycle = 0; cycle < cycles; cycle++) {
      // Кластер камер (2 штуки)
      if (shuffledCameras.length > 0) {
        for (let i = 0; i < 2 && cameraIndex < shuffledCameras.length; i++) {
          clusters.push(addLabels(shuffledCameras[cameraIndex]));
          cameraIndex++;
        }
      }

      // Кластер мониторов (1 штука)
      if (shuffledMonitors.length > 0 && monitorIndex < shuffledMonitors.length) {
        clusters.push(addLabels(shuffledMonitors[monitorIndex]));
        monitorIndex++;
      }

      // Кластер видеорегистраторов (1 штука)
      if (shuffledRecorders.length > 0 && recorderIndex < shuffledRecorders.length) {
        clusters.push(addLabels(shuffledRecorders[recorderIndex]));
        recorderIndex++;
      }

      // Если товары закончились, начинаем заново
      if (cameraIndex >= shuffledCameras.length && 
          monitorIndex >= shuffledMonitors.length && 
          recorderIndex >= shuffledRecorders.length) {
        cameraIndex = 0;
        monitorIndex = 0;
        recorderIndex = 0;
      }
    }

    return clusters.slice(0, 12);
  }, [filteredProductsByCategory]);

  // Обновляем CSS переменную для паузы анимации
  useEffect(() => {
    if (marqueeContentRef.current) {
      marqueeContentRef.current.style.setProperty('--animation-play-state', isPaused ? 'paused' : 'running');
    }
  }, [isPaused]);

  const handleProductClick = useCallback((product) => {
    if (onProductClick && product.model) {
      onProductClick(product.model);
    }
  }, [onProductClick]);

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <section 
      className="smart-marquee"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="marquee-header">
        <div className="marquee-title">
          <svg className="marquee-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2l2.5 5.5L18 8.5l-4.5 4 1 6-4.5-2.5L10 18.5l-1-6-4.5-4 5.5-1L10 2z" fill="currentColor" opacity="0.9"/>
          </svg>
          <span className="marquee-text">Популярные товары</span>
        </div>
      </div>
      
      <div className="marquee-container">
        <div
          ref={marqueeContentRef}
          className="marquee-content"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {(() => {
            const renderCards = (copyId = '') =>
              displayProducts.map((product, index) => {
                const imageUrl = generateImageUrl(product);
                const price = product.final_price != null && !isNaN(product.final_price) && Number(product.final_price) > 0
                  ? Number(product.final_price) : null;
                const priceLabel = price ? new Intl.NumberFormat('ru-RU').format(Math.round(price)) + ' ₸' : 'по запросу';
                return (
                  <motion.div
                    key={`${product.model}-${index}${copyId}`}
                    className="marquee-card"
                    onClick={() => handleProductClick(product)}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="marquee-card-image">
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name || product.model} loading="lazy" />
                      ) : (
                        <div className="marquee-card-placeholder">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 7h-4V5l-2-2H6L4 5v2H0v2h2v10a2 2 0 002 2h16a2 2 0 002-2V9h2V7zM6 5h8v2H6V5zm12 14H6V9h12v10z" fill="currentColor" opacity="0.3"/>
                          </svg>
                        </div>
                      )}
                      {product.reason === 'discount' && (
                        <div className="marquee-badge marquee-badge-hot" title="Скидка">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1z" fill="currentColor"/>
                          </svg>
                        </div>
                      )}
                      {product.reason === 'low-stock' && (
                        <div className="marquee-badge marquee-badge-low" title="Осталось мало">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0z" fill="currentColor"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="marquee-card-info">
                      <div className="marquee-card-name" title={product.name || product.model}>
                        {product.name || product.model}
                      </div>
                      <div className="marquee-card-label">{product.label}</div>
                      <div className="marquee-card-price">{priceLabel}</div>
                    </div>
                  </motion.div>
                );
              });
            return (
              <>
                {renderCards('a')}
                {renderCards('b')}
              </>
            );
          })()}
        </div>
      </div>

      {/* Градиенты для плавного затухания */}
      <div className="marquee-gradient marquee-gradient-left"></div>
      <div className="marquee-gradient marquee-gradient-right"></div>
    </section>
  );
}
