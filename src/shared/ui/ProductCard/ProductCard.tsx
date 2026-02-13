import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '@/shared/context/CartContext';
import { getProductImageUrl, type Product } from '@/shared/api/productApi';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  onDetailClick?: (model: string) => void;
}

export function ProductCard({ product, onDetailClick }: ProductCardProps) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = () => {
    addToCart(product.model, 1);
  };

  const imageUrl = product.image || getProductImageUrl(product.model);

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className={styles.imageWrapper} onClick={() => onDetailClick?.(product.model)}>
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
      <div className={styles.content}>
        <h3 className={styles.name} onClick={() => onDetailClick?.(product.model)}>
          {product.name}
        </h3>
        <p className={styles.model}>{product.model}</p>
        <p className={styles.brand}>{product.brand}</p>
        <div className={styles.priceRow}>
          {product.discount > 0 && (
            <span className={styles.oldPrice}>{product.price_rrc.toFixed(0)} ₸</span>
          )}
          <span className={styles.price}>{product.final_price.toFixed(0)} ₸</span>
          {product.discount > 0 && (
            <span className={styles.discount}>-{product.discount.toFixed(0)}%</span>
          )}
        </div>
        {product.quantity > 0 ? (
          <span className={styles.stock}>В наличии: {product.quantity}</span>
        ) : (
          <span className={styles.outOfStock}>Нет в наличии</span>
        )}
        <button
          className={styles.addButton}
          onClick={handleAddToCart}
          disabled={product.quantity === 0}
        >
          В корзину
        </button>
      </div>
    </motion.article>
  );
}
