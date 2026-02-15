import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { akuvoxSmartSystems, CATEGORY_DISPLAY_NAMES } from '@/shared/content/akuvoxSmartSystems';
import type { AkuvoxProduct } from '@/shared/content/akuvoxSmartSystems';
import { SmartSystemsProductModal } from './SmartSystemsProductModal';
import { useCart } from '@/shared/context/CartContext';
import styles from './SmartSystemsSection.module.css';

interface SmartSystemsSectionProps {
  productLimit?: number;
  compact?: boolean;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

function ProductCard({
  product,
  onCardClick,
  reduceMotion,
}: {
  product: AkuvoxProduct;
  onCardClick: (product: AkuvoxProduct) => void;
  reduceMotion: boolean | null;
}) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const hasImage = product.image && !imageError;

  const handleClick = () => onCardClick(product);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      model: product.model,
      name: product.model,
      brand: 'Akuvox',
      price: product.priceKzt,
    }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title="Открыть карточку товара"
      whileHover={reduceMotion ? undefined : { y: -4, transition: spring }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      <div className={styles.cardImageWrapper}>
        {hasImage ? (
          <img
            src={product.image}
            alt={product.model}
            className={styles.cardImage}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={styles.cardImagePlaceholder}>
            <span>📦</span>
          </div>
        )}
        <div className={styles.brandBadge}>Akuvox</div>
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardDescriptionBlock}>
          <div className={styles.cardModel}>{product.model}</div>
          <div className={styles.cardModelSecondary}>{product.model}</div>
        </div>
        <div className={styles.productDetails}>
          <div className={styles.cardPrice}>
            {Number(product.priceKzt).toLocaleString('ru-KZ')} ₸
          </div>
        </div>
        <div className={styles.qtyRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.qtyLabel}>Кол-во:</span>
          <div className={styles.qtyControl}>
            <button type="button" aria-label="Меньше" onClick={() => setQty((n) => Math.max(1, n - 1))}>−</button>
            <span className={styles.qtyNum}>{qty}</span>
            <button type="button" aria-label="Больше" onClick={() => setQty((n) => Math.min(99, n + 1))}>+</button>
          </div>
        </div>
        <button
          className={`${styles.addButton} ${added ? styles.addButtonAdded : ''}`}
          onClick={handleAddToCart}
          type="button"
          aria-label="Добавить в корзину"
        >
          {added ? '✓ Добавлено' : `🛒 В корзину (${qty})`}
        </button>
      </div>
    </motion.div>
  );
}

export function SmartSystemsSection({ productLimit, compact = false }: SmartSystemsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<AkuvoxProduct | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleCardClick = useCallback((product: AkuvoxProduct) => {
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => setSelectedProduct(null), []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProduct) handleCloseModal();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedProduct, handleCloseModal]);

  const categories = useMemo(() => akuvoxSmartSystems.categories, []);

  /** Опции фильтра: «Все товары» + каждая категория из данных */
  const categoryOptions = useMemo(
    () => [
      { id: '', title: 'Все товары' },
      ...categories.map((cat) => ({
        id: cat.id,
        title: CATEGORY_DISPLAY_NAMES[cat.id] ?? cat.title,
      })),
    ],
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const hasCategory = categoryId.length > 0;
    const applyLimit = productLimit && !hasSearch && !hasCategory;

    const catsToShow = hasCategory ? categories.filter((c) => c.id === categoryId) : categories;

    return catsToShow
      .map((cat) => {
        let products = cat.products;
        if (hasSearch) {
          products = products.filter(
            (p) =>
              (p.model || '').toLowerCase().includes(q) ||
              (p.descriptionRu || '').toLowerCase().includes(q)
          );
        }
        if (applyLimit) products = products.slice(0, productLimit!);
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [categories, productLimit, searchQuery, categoryId]);

  const sectionMotion = shouldReduceMotion
    ? {}
    : {
        initial: { y: 12, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.4, ease: 'easeOut' as const },
      };

  return (
    <motion.section
      className={compact ? styles.sectionCompact : styles.section}
      aria-labelledby="smart-systems-heading"
      {...sectionMotion}
    >
      <div className={styles.sectionContent}>
      {!compact && (
        <div className={styles.filtersBlock}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label htmlFor="smart-category-select">Категории</label>
              <select
                id="smart-category-select"
                className={styles.filterSelect}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Категория"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id || 'all'} value={opt.id}>
                    {opt.title}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="smart-brand-select">Бренды</label>
              <select
                id="smart-brand-select"
                className={styles.filterSelect}
                aria-label="Бренд"
                defaultValue=""
              >
                <option value="">Все бренды</option>
                <option value="Akuvox">Akuvox</option>
              </select>
            </div>
            <div className={`${styles.filterGroup} ${styles.filterSearch}`}>
              <label htmlFor="smart-search-input">Поиск</label>
              <div className={styles.searchWrapper}>
                <input
                  type="search"
                  id="smart-search-input"
                  className={styles.filterInput}
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Поиск товаров"
                />
                <button type="button" className={styles.btnSearch} aria-label="Искать">
                  <span aria-hidden>🔍</span>
                </button>
              </div>
            </div>
          </div>
          <div className={styles.categoryTags}>
            {categoryOptions
              .filter((opt) => opt.id)
              .map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.categoryTag} ${categoryId === opt.id ? styles.categoryTagActive : ''}`}
                  onClick={() => setCategoryId(categoryId === opt.id ? '' : opt.id)}
                >
                  {opt.title}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className={styles.categories}>
        {filteredCategories.map((cat) => {
          const origLen = categories.find((c) => c.id === cat.id)?.products.length ?? 0;
          const showMore =
            productLimit && !categoryId && !searchQuery && origLen > productLimit && cat.products.length === productLimit;
          return (
            <div key={cat.id} className={styles.category}>
              <h3 className={styles.categoryTitle}>{CATEGORY_DISPLAY_NAMES[cat.id] ?? cat.title}</h3>
              <div className={styles.cards}>
                {cat.products.map((product, idx) => (
                  <ProductCard
                    key={`${cat.id}-${product.model}-${idx}`}
                    product={product}
                    onCardClick={handleCardClick}
                    reduceMotion={!!shouldReduceMotion}
                  />
                ))}
              </div>
              {showMore && (
                <p className={styles.categoryMore}>
                  Ещё {origLen - productLimit} позиций в категории
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!compact && filteredCategories.length === 0 && (
        <p className={styles.filterEmpty}>По вашему запросу ничего не найдено.</p>
      )}
      </div>

      <SmartSystemsProductModal product={selectedProduct} onClose={handleCloseModal} />
    </motion.section>
  );
}
