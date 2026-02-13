import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getProductDetail, getProductImageUrl, type ProductDetail } from '@/shared/api/productApi';
import { useCart } from '@/shared/context/CartContext';
import styles from './ProductModal.module.css';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: string;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export function ProductModal({ isOpen, onClose, model }: ProductModalProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { addToCart } = useCart();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen || !model) return;

    setLoading(true);
    setImageError(false);
    getProductDetail(model)
      .then(setProduct)
      .catch((e) => {
        console.error('Error loading product:', e);
      })
      .finally(() => setLoading(false));
  }, [isOpen, model]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product.model, 1);
    }
  };

  const imageUrl = product?.image || (product ? getProductImageUrl(product.model) : '');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          variants={reduceMotion ? undefined : overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            variants={reduceMotion ? undefined : modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.header}>
              <h2 className={styles.title}>
                {loading ? 'Загрузка...' : product?.name || 'Товар'}
              </h2>
              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className={styles.body}>
              {loading ? (
                <div className={styles.loading}>Загрузка данных...</div>
              ) : product ? (
                <>
                  <div className={styles.imageSection}>
                    {!imageError ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className={styles.image}
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <span>{product.brand[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.infoSection}>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Модель:</span>
                      <span className={styles.value}>{product.model}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Бренд:</span>
                      <span className={styles.value}>{product.brand}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Цена:</span>
                      <div className={styles.priceRow}>
                        {product.discount > 0 && (
                          <span className={styles.oldPrice}>
                            {product.price_rrc.toFixed(0)} ₸
                          </span>
                        )}
                        <span className={styles.price}>{product.final_price.toFixed(0)} ₸</span>
                        {product.discount > 0 && (
                          <span className={styles.discount}>-{product.discount.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Наличие:</span>
                      <span className={product.quantity > 0 ? styles.stock : styles.outOfStock}>
                        {product.quantity > 0 ? `В наличии: ${product.quantity}` : 'Нет в наличии'}
                      </span>
                    </div>
                    {product.description && (
                      <div className={styles.description}>
                        <h3>Описание</h3>
                        <p>{product.description}</p>
                      </div>
                    )}
                    {product.attributes && Object.keys(product.attributes).length > 0 && (
                      <div className={styles.attributes}>
                        <h3>Характеристики</h3>
                        <dl>
                          {Object.entries(product.attributes).map(([key, value]) => (
                            <div key={key} className={styles.attribute}>
                              <dt>{key}:</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    <button
                      className={styles.addButton}
                      onClick={handleAddToCart}
                      disabled={product.quantity === 0}
                    >
                      Добавить в корзину
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.error}>Товар не найден</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
