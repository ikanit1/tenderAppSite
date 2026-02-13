import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../hooks/useCart';
import { useResetFilters } from '../context/ResetFiltersContext';
import styles from './FloatingActionsBar.module.css';

const btnTap = { scale: 0.95 };
const btnHover = { scale: 1.05 };

const containerVariants = {
  hidden: { x: 100, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      staggerChildren: 0.1,
    },
  },
};

const buttonVariants = {
  hidden: { x: 50, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
};

export default function FloatingActionsBar({ onCartToggle }) {
  const { totalCount, totalSum } = useCart();
  const { resetFiltersFn } = useResetFilters();

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(price));
  };

  return (
    <motion.div
      className={styles.floatingActionsBar}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.actionsList}>
        {/* Кнопка корзины */}
        <motion.button
          className={styles.actionButton}
          onClick={onCartToggle}
          type="button"
          aria-label="Корзина"
          variants={buttonVariants}
          whileHover={btnHover}
          whileTap={btnTap}
        >
          <svg className={styles.actionIcon} width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3h1.5l1.5 8h7l1.5-8H13M3 3L2 1H1M3 3l1.5 8h7M6 13.5a.5.5 0 11-1 0 .5.5 0 011 0zM13 13.5a.5.5 0 11-1 0 .5.5 0 011 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className={styles.actionLabel}>Корзина</span>
          <AnimatePresence>
            {totalCount > 0 && (
              <motion.span
                key={totalCount}
                className={styles.cartBadge}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {totalCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Кнопка сброса фильтров */}
        {resetFiltersFn && (
          <motion.button
            className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
            onClick={resetFiltersFn}
            type="button"
            aria-label="Сбросить фильтры"
            variants={buttonVariants}
            whileHover={btnHover}
            whileTap={btnTap}
          >
            <svg className={styles.actionIcon} width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 8h14M8 1l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={styles.actionLabel}>Сбросить</span>
          </motion.button>
        )}

        {/* Кнопка оформления заказа */}
        <AnimatePresence>
          {totalCount > 0 && (
            <motion.div
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <motion.div
                whileHover={btnHover}
                whileTap={btnTap}
              >
                <Link
                  to="/checkout"
                  className={`${styles.actionButton} ${styles.actionButtonSuccess}`}
                >
                  <svg className={styles.actionIcon} width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4h12M2 4l1-2h10l1 2M2 4v9a1 1 0 001 1h10a1 1 0 001-1V4M6 7v4M10 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className={styles.actionLabel}>Заказ</span>
                  <span className={styles.orderTotal}>{formatPrice(totalSum)} ₸</span>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
