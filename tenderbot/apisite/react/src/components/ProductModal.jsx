import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../hooks/useCart';
import { generateImageUrl, generateAlternativeImageUrls } from '../utils/imageUrl';

const modalTransition = { type: 'tween', duration: 0.25, ease: [0.25, 0.1, 0.25, 1] };
const detailVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const detailItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function ProductModal({ isOpen, model, onClose }) {
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackAttempts, setFallbackAttempts] = useState(0);

  useEffect(() => {
    if (isOpen && model) {
      loadProductDetail();
    } else {
      setProduct(null);
      setError(null);
      setSelectedImageIndex(0);
    }
  }, [isOpen, model]);

  const loadProductDetail = async () => {
    if (!model) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(model)}/detail`);
      if (!response.ok) throw new Error('Товар не найден');
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const formatPrice = (price) => {
    if (price == null || isNaN(price)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(price));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="product-modal" className="product-modal open" aria-hidden="false" onClick={onClose}>
          <motion.div
            className="product-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
          />
          <motion.div
            className="product-modal-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={modalTransition}
          >
            <button type="button" className="product-modal-close" onClick={onClose} aria-label="Закрыть">&times;</button>
            <div className="product-modal-content">
              {loading && <div className="product-modal-loading">Загрузка...</div>}
              {error && <div className="product-modal-error">Не удалось загрузить данные товара.</div>}
              {product && (
                <motion.div
                  className="product-detail"
                  variants={detailVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div className="product-detail-gallery" variants={detailItemVariants}>
                <div className="product-detail-main">
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[selectedImageIndex] || product.images[0]} 
                      alt={product.name}
                      id="productDetailMainImg"
                    />
                  ) : (
                    <img 
                      src={generateImageUrl(product) || `/api/products/${encodeURIComponent(String(product.model || '').trim())}/image`}
                      alt={product.name}
                      id="productDetailMainImg"
                      onError={(e) => {
                        const model = String(product.model || '').trim();
                        const failedUrl = e.target.src;
                        
                        console.warn('Modal image failed to load:', failedUrl, 'for product:', model);
                        
                        // Пробуем альтернативные варианты кодирования модели
                        if (model && fallbackAttempts < 3) {
                          const alternatives = generateAlternativeImageUrls(model);
                          const nextAttempt = fallbackAttempts + 1;
                          
                          if (nextAttempt < alternatives.length) {
                            const nextUrl = alternatives[nextAttempt];
                            if (nextUrl !== failedUrl) {
                              console.log(`Trying alternative URL ${nextAttempt + 1}:`, nextUrl);
                              setFallbackAttempts(nextAttempt);
                              setImageError(false);
                              setTimeout(() => {
                                if (e.target) {
                                  e.target.src = nextUrl;
                                }
                              }, 0);
                              return;
                            }
                          }
                        }
                        
                        // Все варианты исчерпаны
                        setImageError(true);
                        console.warn('All image URL alternatives failed for product:', model);
                      }}
                    />
                  )}
                </div>
                {product.images && product.images.length > 1 && (
                  <div className="product-detail-thumbs">
                    {product.images.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`product-detail-thumb ${i === selectedImageIndex ? 'active' : ''}`}
                        onClick={() => setSelectedImageIndex(i)}
                      >
                        <img src={url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                  </motion.div>
                  <motion.div className="product-detail-info" variants={detailItemVariants}>
                <div className="product-detail-brand">{product.brand}</div>
                <h2 className="product-detail-name">{product.name}</h2>
                <div className="product-detail-model">Модель: {product.model}</div>
                <div className="product-detail-price">
                  {product.final_price != null && !isNaN(product.final_price) && Number(product.final_price) > 0 ? (
                    <span className="price-value">{formatPrice(product.final_price)} ₸</span>
                  ) : (
                    <span className="price-value">по запросу</span>
                  )}
                  {product.discount > 0 && (
                    <span className="discount-badge">−{product.discount.toFixed(0)}%</span>
                  )}
                </div>
                <div className="product-detail-qty">
                  В наличии: {product.quantity != null ? `${product.quantity} шт.` : '—'}
                </div>
                <button
                  type="button"
                  className={`btn-add-cart-modal ${added ? 'added' : ''}`}
                  onClick={handleAddToCart}
                  disabled={added}
                >
                  {added ? '✓ Добавлено' : '🛒 В корзину'}
                </button>
                {product.description && (
                  <div className="product-detail-desc">
                    <h3>Описание</h3>
                    <div className="product-detail-desc-text">
                      {product.description.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
                {product.attributes && Object.keys(product.attributes).length > 0 && (
                  <div className="product-detail-attrs-wrap">
                    <h3>Характеристики</h3>
                    <table className="product-detail-attrs">
                      <tbody>
                        {Object.entries(product.attributes).map(([key, value]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>{String(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
