import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../hooks/useCart';

const panelTransition = { type: 'tween', duration: 0.25, ease: [0.25, 0.1, 0.25, 1] };
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

const isInIframe =
  typeof window !== 'undefined' &&
  (window !== window.parent ||
    new URLSearchParams(window.location.search).get('embedded') === '1');

export default function CartPanel({ isOpen, onClose }) {
  if (isInIframe) return null;
  const { cart, removeFromCart, updateQty, totalSum } = useCart();

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(price));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cart-panel"
          className="cart-panel open"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={panelTransition}
        >
          <motion.div
            className="cart-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={panelTransition}
          />
          <motion.div
            className="cart-panel-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={panelTransition}
          >
            <div className="cart-panel-header">
              <h2>Корзина</h2>
              <button type="button" className="cart-panel-close" onClick={onClose} aria-label="Закрыть">&times;</button>
            </div>
            <div className="cart-list">
              {cart.length === 0 ? (
                <motion.p
                  className="cart-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Корзина пуста
                </motion.p>
              ) : (
                <motion.div variants={listVariants} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cart.map((item) => {
                    const priceLabel = item.price != null ? formatPrice(item.price) + ' ₸' : 'по запросу';
                    const lineTotal = item.price != null ? formatPrice((item.price || 0) * (item.quantity || 1)) + ' ₸' : '—';
                    return (
                      <motion.div
                        key={item.model}
                        className="cart-item"
                        variants={itemVariants}
                        layout
                      >
                        <div className="cart-item-info">
                          <div className="cart-item-name">{item.name}</div>
                          <div className="cart-item-model">{item.model}</div>
                          <div className="cart-item-price">{priceLabel} × {item.quantity || 1} = {lineTotal}</div>
                        </div>
                        <div className="cart-item-actions">
                          <button
                            type="button"
                            className="cart-qty-btn"
                            onClick={() => updateQty(item.model, -1)}
                          >−</button>
                          <span className="cart-qty">{item.quantity || 1}</span>
                          <button
                            type="button"
                            className="cart-qty-btn"
                            onClick={() => updateQty(item.model, 1)}
                          >+</button>
                          <button
                            type="button"
                            className="cart-remove"
                            onClick={() => removeFromCart(item.model)}
                            title="Удалить"
                          >×</button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
            <motion.div
              className="cart-panel-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="cart-total">Итого: <span>{formatPrice(totalSum)}</span> ₸</div>
              <Link to="/checkout" className="btn-action btn-success btn-block" onClick={onClose}>
                Оформить заказ
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
