import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Background from '../components/Background';
import SmartMarquee from '../components/SmartMarquee';
import Header from '../components/Header';
import FloatingActionsBar from '../components/FloatingActionsBar';
import CartPanel from '../components/CartPanel';
// import AboutSection from '../components/AboutSection';
import { TrustBadge3D, badgeTypes } from '../components/TrustBadge3D';
import Filters from '../components/Filters';
import ProductCard from '../components/ProductCard';
import LazyProductCard from '../components/LazyProductCard';
import ProductModal from '../components/ProductModal';
import { useProducts } from '../hooks/useProducts';
import { CATEGORY_KEYWORDS } from '../components/Filters';
import { useResetFilters } from '../context/ResetFiltersContext';
import { getBotUrl } from '../utils/botUrl';

export default function Home() {
  const { products, loading, error, brands } = useProducts();
  const { setResetFiltersFn } = useResetFilters();
  const botUrl = getBotUrl();
  const [filters, setFilters] = useState({ search: '', category: 'ip-cameras', brand: '' });
  const [modalModel, setModalModel] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const onCartToggle = () => setCartOpen((prev) => !prev);

  const handleResetFilters = useCallback(() => {
    setFilters({ search: '', category: 'ip-cameras', brand: '' });
  }, []);

  useEffect(() => {
    setResetFiltersFn(() => handleResetFilters);
    return () => setResetFiltersFn(null);
  }, [setResetFiltersFn, handleResetFilters]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Поиск
    if (filters.search) {
      const term = filters.search.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(term);
        const modelMatch = (p.model || '').toLowerCase().includes(term);
        const brandMatch = (p.brand || '').toLowerCase().includes(term);
        return nameMatch || modelMatch || brandMatch;
      });
    }

    // Бренд
    if (filters.brand) {
      filtered = filtered.filter(p => (p.brand || '').toLowerCase() === filters.brand.toLowerCase());
    }

    // Категория - строгая фильтрация с типизацией
    if (filters.category) {
      const categoryRules = CATEGORY_KEYWORDS[filters.category];
      if (categoryRules) {
        filtered = filtered.filter(p => {
          const productText = `${p.name} ${p.model} ${p.brand}`.toLowerCase();
          
          // ШАГ 1: СТРОГАЯ ПРОВЕРКА ИСКЛЮЧЕНИЙ
          // Если товар содержит любое исключающее слово, он НЕ подходит для этой категории
          if (categoryRules.exclude && categoryRules.exclude.length > 0) {
            const hasExcluded = categoryRules.exclude.some(excludeWord => {
              const word = excludeWord.toLowerCase().trim();
              if (!word) return false;
              
              // Для многословных исключений (например, "ip camera") проверяем фразу целиком
              if (word.includes(' ')) {
                return productText.includes(word);
              }
              
              // Для однострочных слов проверяем вхождение
              // Это критично для исключения товаров из других категорий
              return productText.includes(word);
            });
            if (hasExcluded) {
              return false; // Товар исключен из этой категории
            }
          }
          
          // ШАГ 2: ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ СЛОВ
          // Товар ДОЛЖЕН содержать хотя бы одно обязательное слово (если они указаны)
          if (categoryRules.require && categoryRules.require.length > 0) {
            const hasRequired = categoryRules.require.some(requireWord => {
              const word = requireWord.toLowerCase().trim();
              if (!word) return false;
              
              // Для многословных обязательных фраз (например, "точка доступа") проверяем фразу целиком
              if (word.includes(' ')) {
                return productText.includes(word);
              }
              
              return productText.includes(word);
            });
            if (!hasRequired) {
              return false; // Товар не содержит обязательных слов
            }
          }
          
          // ШАГ 3: ПРОВЕРКА ВКЛЮЧЕНИЙ
          // Товар должен содержать хотя бы одно ключевое слово из списка включений
          if (categoryRules.include && categoryRules.include.length > 0) {
            const hasIncluded = categoryRules.include.some(includeWord => {
              const word = includeWord.toLowerCase().trim();
              if (!word) return false;
              
              // Для многословных включений проверяем фразу целиком
              if (word.includes(' ')) {
                return productText.includes(word);
              }
              
              return productText.includes(word);
            });
            if (!hasIncluded) {
              return false; // Товар не содержит ключевых слов категории
            }
          } else {
            // Если нет включений (например, для категории "other"), 
            // товар подходит только если он прошел проверку исключений
            return true;
          }
          
          // Если все проверки пройдены, товар подходит для категории
          return true;
        });
      }
    }

    return filtered;
  }, [products, filters]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleCardClick = useCallback((model) => {
    setModalModel(model);
  }, []);

  const handleCloseModal = () => {
    setModalModel(null);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modalModel) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [modalModel]);

  return (
    <>
      <Background />
      <Header onCartToggle={onCartToggle} />
      <SmartMarquee products={products} onProductClick={handleCardClick} />
      <FloatingActionsBar onCartToggle={onCartToggle} />
      
      <div className="container">
        <Filters brands={brands} onFilterChange={handleFilterChange} onReset={handleResetFilters} />

        {loading && (
          <motion.div
            className="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="spinner"></div>
            <p>Загрузка товаров...</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            className="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <p>❌ Ошибка загрузки данных. Попробуйте обновить страницу.</p>
          </motion.div>
        )}

        {!loading && !error && (
          <>
            {filteredProducts.length === 0 ? (
              <motion.div
                className="no-results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p>😔 Товары не найдены</p>
              </motion.div>
            ) : (
              <div className="products-grid">
                {filteredProducts.map((product, index) => {
                  const uniqueKey = `${product.model || 'unknown'}-${product.brand || 'no-brand'}-${product.name || index}-${index}`;
                  const isInitial = index < 10;
                  const delay = isInitial ? 0 : (index - 10) * 50;
                  return isInitial ? (
                    <ProductCard
                      key={uniqueKey}
                      product={product}
                      onCardClick={handleCardClick}
                    />
                  ) : (
                    <LazyProductCard
                      key={uniqueKey}
                      product={product}
                      onCardClick={handleCardClick}
                      delay={delay}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ProductModal isOpen={!!modalModel} model={modalModel} onClose={handleCloseModal} />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      
      {/* Trust Badges */}
      <div className="container">
        <motion.div
          className="trust-badges"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <TrustBadge3D
            type={badgeTypes.delivery}
            text="Быстрая доставка"
          />
          <TrustBadge3D
            type={badgeTypes.quality}
            text="Гарантия качества"
          />
          <TrustBadge3D
            type={badgeTypes.payment}
            text="Удобная оплата"
          />
          <TrustBadge3D
            type={badgeTypes.support}
            text="Поддержка 24/7"
          />
        </motion.div>
      </div>

      <motion.footer
        className="footer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
      >
        <div className="container">
          <p>B2B Products API &copy; 2026</p>
          <p>
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              Написать в Telegram-бот
            </a>
          </p>
        </div>
      </motion.footer>
    </>
  );
}
