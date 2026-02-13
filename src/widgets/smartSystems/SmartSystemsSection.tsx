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
  showFullDesc,
  onCardClick,
  reduceMotion,
}: {
  product: AkuvoxProduct;
  showFullDesc: boolean;
  onCardClick: (product: AkuvoxProduct) => void;
  reduceMotion: boolean | null;
}) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [added, setAdded] = useState(false);
  const hasImage = product.image && !imageError;
  const desc = product.descriptionRu || '';
  const shortDesc = desc.split('\n')[0]?.slice(0, 120) + (desc.length > 120 ? '…' : '');
  const fullDesc = desc.replace(/\n/g, ' • ').trim();

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
    }, 1);
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
      {hasImage ? (
        <div className={styles.cardImageWrapper}>
          <img
            src={product.image}
            alt={product.model}
            className={styles.cardImage}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className={styles.cardImagePlaceholder}>
          <span>📦</span>
        </div>
      )}
      <div className={styles.cardInfo}>
        <div className={styles.cardDescriptionBlock}>
          <div className={styles.cardModel}>{product.model}</div>
          <p className={styles.cardDesc} title={fullDesc}>
            {showFullDesc ? fullDesc : shortDesc}
          </p>
        </div>
        <div className={styles.cardPrice}>
          {Number(product.priceKzt).toLocaleString('ru-KZ')} ₸
        </div>
        <button
          className={`${styles.addButton} ${added ? styles.addButtonAdded : ''}`}
          onClick={handleAddToCart}
          type="button"
          aria-label="Добавить в корзину"
        >
          {added ? '✓ Добавлено' : '🛒 В корзину'}
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
  const categoryOptions = useMemo(
    () => [
      { id: '', title: 'Все категории' },
      ...categories.map((c) => ({ id: c.id, title: CATEGORY_DISPLAY_NAMES[c.id] ?? c.title })),
    ],
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const hasCategory = categoryId.length > 0;
    const applyLimit = productLimit && !hasSearch && !hasCategory;
    return categories
      .map((cat) => {
        if (hasCategory && cat.id !== categoryId) return { ...cat, products: [] };
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
      {!compact && (
        <div className={styles.filters}>
          <input
            type="search"
            className={styles.filterSearch}
            placeholder="Поиск по модели или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Поиск товаров"
          />
          <select
            className={styles.filterCategory}
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
                    showFullDesc={!compact}
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

      <SmartSystemsProductModal product={selectedProduct} onClose={handleCloseModal} />
    </motion.section>
  );
}
