import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { sendAssistantMessage, getProductByModel, type Product } from '@/shared/api/productApi';
import { useCart } from '@/shared/context/CartContext';
import { useOpenAssistant } from '@/shared/context/OpenAssistantContext';
import { ProductCard } from '@/shared/ui/ProductCard/ProductCard';
import { ProductModal } from '@/shared/ui/ProductModal/ProductModal';
import styles from './Hero.module.css';

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 25 };

export function Hero() {
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [response, setResponse] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductModel, setSelectedProductModel] = useState<string | null>(null);
  const { getCartModels } = useCart();
  const { openAssistant } = useOpenAssistant();
  const reduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setResponse('');
    setProducts([]);

    try {
      const budgetNum = budget ? parseFloat(budget) : null;
      const cart = getCartModels();

      const result = await sendAssistantMessage({
        message: message.trim(),
        budget: budgetNum,
        brands: selectedBrands.length > 0 ? selectedBrands : null,
        cart: cart.length > 0 ? cart : undefined,
      });

      setResponse(result.text);

      // Загружаем детали товаров по моделям
      if (result.product_models.length > 0) {
        const productPromises = result.product_models
          .slice(0, 12) // Максимум 12 товаров
          .map((model) =>
            getProductByModel(model).catch((e) => {
              console.error(`Error loading product ${model}:`, e);
              return null;
            })
          );

        const loadedProducts = await Promise.all(productPromises);
        setProducts(loadedProducts.filter((p): p is Product => p !== null));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const message = error instanceof Error ? error.message : 'Произошла ошибка при обработке запроса. Попробуйте позже.';
      setResponse(`Ошибка: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const popularBrands = ['Hikvision', 'Dahua', 'HiWatch', 'RVi', 'Beward'];

  return (
    <motion.section
      className={styles.hero}
      aria-label="ИИ-помощник"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.container}>
        <motion.div
          className={styles.gradientBlock}
          variants={reduceMotion ? undefined : itemVariants}
        >
          <motion.h1 className={styles.title} variants={reduceMotion ? undefined : itemVariants}>
            Умный помощник G&R Group
          </motion.h1>
          <motion.p
            className={styles.subtitle}
            variants={reduceMotion ? undefined : itemVariants}
          >
            Навигатор по сайту и консультант по подбору комплектующих для систем видеонаблюдения
            и слаботочных систем
          </motion.p>

          <motion.div
            className={styles.quickLinks}
            variants={reduceMotion ? undefined : itemVariants}
          >
            <Link to="/services" className={styles.quickLink}>
              Услуги
            </Link>
            <Link to="/projects" className={styles.quickLink}>
              Проекты
            </Link>
            <Link to="/calculator" className={styles.quickLink}>
              Калькулятор
            </Link>
            <Link to="/contacts" className={styles.quickLink}>
              Контакты
            </Link>
          </motion.div>

          <motion.form
            className={styles.form}
            onSubmit={handleSubmit}
            variants={reduceMotion ? undefined : itemVariants}
          >
            <div className={styles.inputGroup}>
              <textarea
                className={styles.messageInput}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Опишите задачу или задайте вопрос..."
                rows={3}
                required
              />
            </div>

            <div className={styles.filters}>
              <div className={styles.budgetGroup}>
                <label htmlFor="budget" className={styles.label}>
                  Бюджет (₸)
                </label>
                <input
                  id="budget"
                  type="number"
                  className={styles.budgetInput}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Не указан"
                  min="0"
                />
              </div>

              <div className={styles.brandsGroup}>
                <label className={styles.label}>Предпочтительные бренды</label>
                <div className={styles.brandTags}>
                  {popularBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className={`${styles.brandTag} ${
                        selectedBrands.includes(brand) ? styles.brandTagActive : ''
                      }`}
                      onClick={() => handleBrandToggle(brand)}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              className={styles.submitButton}
              disabled={loading || !message.trim()}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              {loading ? 'Обработка...' : 'Спросить'}
            </motion.button>
          </motion.form>

          <AnimatePresence mode="wait">
            {response && (
              <motion.div
                className={styles.response}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={springTransition}
              >
                <div className={styles.responseText}>{response}</div>

                {products.length > 0 && (
                  <div className={styles.productsGrid}>
                    {products.map((product) => (
                      <ProductCard
                        key={product.model}
                        product={product}
                        onDetailClick={setSelectedProductModel}
                      />
                    ))}
                  </div>
                )}

                <motion.button
                  className={styles.continueButton}
                  onClick={openAssistant}
                  whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  Продолжить в чате
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {selectedProductModel && (
        <ProductModal
          isOpen={!!selectedProductModel}
          onClose={() => setSelectedProductModel(null)}
          model={selectedProductModel}
        />
      )}
    </motion.section>
  );
}
