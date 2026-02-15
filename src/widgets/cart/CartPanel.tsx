import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/shared/context/CartContext';
import { getCatalogUrl } from '@/shared/utils/catalogUrl';
import styles from './CartPanel.module.css';

const panelTransition = { type: 'tween' as const, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
  exit: {},
};
const itemVariants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartPanel({ isOpen, onClose }: CartPanelProps) {
  const { items, removeFromCart, updateQty, totalSum, refreshCart, saveCartNow } = useCart();

  // Синхронизация с API при открытии панели (корзина с 8001 видна на 5173)
  useEffect(() => {
    if (isOpen) void refreshCart();
  }, [isOpen, refreshCart]);

  const formatPrice = (price: number | null | undefined) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(price));
  };

  const handleCheckout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (items.length === 0) return;
    try {
      await saveCartNow(items);
      onClose();
      window.location.href = `${getCatalogUrl()}/checkout`;
    } catch (error) {
      console.error('Failed to save cart before checkout', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cart-panel"
          className={styles.panel}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={panelTransition}
        >
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={panelTransition}
          />
          <motion.div
            className={styles.box}
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={panelTransition}
          >
            <div className={styles.header}>
              <h2>Корзина</h2>
              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label="Закрыть"
              >
                &times;
              </button>
            </div>
            <div className={styles.list}>
              {items.length === 0 ? (
                <motion.p
                  className={styles.empty}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Корзина пуста
                </motion.p>
              ) : (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  className={styles.itemsContainer}
                >
                  {items.map((item) => {
                    const priceLabel =
                      item.price != null ? formatPrice(item.price) + ' ₸' : 'по запросу';
                    const lineTotal =
                      item.price != null
                        ? formatPrice((item.price || 0) * (item.quantity || 1)) + ' ₸'
                        : '—';
                    return (
                      <motion.div key={item.model} className={styles.item} variants={itemVariants} layout>
                        <div className={styles.itemInfo}>
                          <div className={styles.itemName}>{item.name || item.model}</div>
                          <div className={styles.itemModel}>{item.model}</div>
                          {item.brand && <div className={styles.itemBrand}>{item.brand}</div>}
                          <div className={styles.itemPrice}>
                            {priceLabel} × {item.quantity || 1} = {lineTotal}
                          </div>
                        </div>
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => updateQty(item.model, -1)}
                            aria-label="Уменьшить количество"
                          >
                            −
                          </button>
                          <span className={styles.qty}>{item.quantity || 1}</span>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => updateQty(item.model, 1)}
                            aria-label="Увеличить количество"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className={styles.remove}
                            onClick={() => removeFromCart(item.model)}
                            title="Удалить"
                            aria-label="Удалить из корзины"
                          >
                            ×
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
            <motion.div
              className={styles.footer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className={styles.total}>
                Итого: <span>{formatPrice(totalSum)}</span> ₸
              </div>
              <a
                href={`${getCatalogUrl()}/checkout`}
                className={styles.checkoutButton}
                onClick={handleCheckout}
              >
                Оформить заказ
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
