import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AkuvoxProduct } from '@/shared/content/akuvoxSmartSystems';
import { useCart } from '@/shared/context/CartContext';
import styles from './SmartSystemsProductModal.module.css';

const modalTransition = { type: 'tween' as const, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };
const detailVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const detailItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

interface SmartSystemsProductModalProps {
  product: AkuvoxProduct | null;
  onClose: () => void;
}

export function SmartSystemsProductModal({ product, onClose }: SmartSystemsProductModalProps) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (product) {
      setImageError(false);
      setAdded(false);
    }
  }, [product?.model]);

  const hasImage = product?.image && !imageError;

  const handleAddToCart = () => {
    if (!product) return;
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
    <AnimatePresence>
      {product && (
        <div
          className={styles.overlay}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-modal-title"
        >
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
          />
          <motion.div
            className={styles.box}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={modalTransition}
          >
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Закрыть"
            >
              ×
            </button>
            <div className={styles.content}>
              <motion.div
                className={styles.detail}
                variants={detailVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div className={styles.gallery} variants={detailItemVariants}>
                  <div className={styles.mainImage}>
                    {hasImage ? (
                      <img
                        src={product.image}
                        alt={product.model}
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className={styles.placeholder}>
                        <span>{product.model[0] || '?'}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
                <motion.div className={styles.info} variants={detailItemVariants}>
                  <h2 id="smart-modal-title" className={styles.name}>
                    {product.model}
                  </h2>
                  <div className={styles.price}>
                    {Number(product.priceKzt).toLocaleString('ru-KZ')} ₸
                  </div>
                  <motion.button
                    className={`${styles.addButton} ${added ? styles.addButtonAdded : ''}`}
                    onClick={handleAddToCart}
                    type="button"
                    aria-label="Добавить в корзину"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {added ? '✓ Добавлено' : 'В корзину'}
                  </motion.button>
                  {product.descriptionRu && (
                    <div className={styles.descBlock}>
                      <h3 className={styles.descTitle}>Описание</h3>
                      <div className={styles.descText}>
                        {product.descriptionRu.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
