import { useState, useEffect, memo } from 'react';
import { useCart } from '../hooks/useCart';
import { generateImageUrl, generateAlternativeImageUrls } from '../utils/imageUrl';

function ProductCardInner({ product, onCardClick }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [fallbackAttempts, setFallbackAttempts] = useState(0);

  const imageUrl = generateImageUrl(product);

  useEffect(() => {
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setFallbackAttempts(0);
    }
  }, [imageUrl]);

  useEffect(() => {
    setImageError(false);
  }, [product.model, imageUrl]);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleCardClick = () => {
    if (onCardClick && product.model) {
      onCardClick(product.model);
    }
  };
  const price = product.final_price != null && !isNaN(product.final_price) && Number(product.final_price) > 0
    ? Number(product.final_price) : null;
  const priceLabel = price ? new Intl.NumberFormat('ru-RU').format(Math.round(price)) + ' ₸' : 'по запросу';

  // Логика количества товара как в оригинале
  const quantity = product.quantity != null ? Number(product.quantity) : null;
  const quantityClass = quantity === 0 
    ? 'out-of-stock' 
    : quantity != null && quantity < 10 
    ? 'low-stock' 
    : 'in-stock';
  
  const quantityText = quantity === null || quantity === undefined
    ? ''
    : quantity === 0 
    ? 'Нет в наличии' 
    : quantity >= 10 
    ? `В наличии: ${quantity} шт.` 
    : `${quantity} шт.`;

  const handleImageError = (e) => {
    const model = (product.model != null ? String(product.model) : '').trim();
    const failedUrl = e.target.src;
    
    console.warn('Image failed to load:', failedUrl, 'for product:', model);
    
    // Пробуем альтернативные варианты кодирования модели
    if (model && fallbackAttempts < 3) {
      const alternatives = generateAlternativeImageUrls(model);
      const nextAttempt = fallbackAttempts + 1;
      
      if (nextAttempt < alternatives.length) {
        const nextUrl = alternatives[nextAttempt];
        if (nextUrl !== failedUrl) {
          console.log(`Trying alternative URL ${nextAttempt + 1}:`, nextUrl);
          setFallbackAttempts(nextAttempt);
          setCurrentImageUrl(nextUrl);
          setImageError(false);
          // Обновим src изображения в следующем рендере
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
    console.warn('All image URL alternatives failed for product:', model);
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  return (
    <div
      className="product-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      title="Открыть карточку товара"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="product-image">
        {currentImageUrl && !imageError ? (
          <img
            key={currentImageUrl} // Ключ для принудительного перерендера при смене URL
            src={currentImageUrl}
            alt={product.name || product.model}
            loading="lazy"
            onError={handleImageError}
            onLoad={handleImageLoad}
            style={{
              position: 'relative',
              zIndex: 1,
            }}
          />
        ) : null}
        {(!currentImageUrl || imageError) && (
          <div className="placeholder">📦</div>
        )}
        <div className="brand-badge">{product.brand || 'Product'}</div>
      </div>
      <div className="product-info">
        <div className="product-description-block">
          <div className="product-name">{product.name || product.model}</div>
          <div className="product-model">{product.model}</div>
        </div>
        <div className="product-details">
          {quantityText && (
            <div className={`quantity ${quantityClass}`}>
              <span>{quantityText}</span>
            </div>
          )}
          <div className="price-section">
            <div className="price-client">{priceLabel}</div>
            {product.discount > 0 && product.price_rrc != null && !isNaN(product.price_rrc) && (
              <>
                <div className="price-rrc">{new Intl.NumberFormat('ru-RU').format(Math.round(product.price_rrc))} ₸</div>
                <div className="discount-badge">-{(product.discount || 0).toFixed(1)}%</div>
              </>
            )}
          </div>
        </div>
        <button
          className={`btn-add-cart ${added ? 'added' : ''}`}
          onClick={handleAddToCart}
          disabled={added}
        >
          {added ? '✓ Добавлено' : '🛒 В корзину'}
        </button>
      </div>
    </div>
  );
}

const ProductCard = memo(ProductCardInner);
export default ProductCard;
