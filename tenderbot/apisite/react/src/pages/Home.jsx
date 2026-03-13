import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Background from '../components/Background';
import SmartMarquee from '../components/SmartMarquee';
import Header from '../components/Header';
import FloatingActionsBar from '../components/FloatingActionsBar';
import CartPanel from '../components/CartPanel';
import { TrustBadge3D, badgeTypes } from '../components/TrustBadge3D';
import Filters from '../components/Filters';
import ProductCard from '../components/ProductCard';
import LazyProductCard from '../components/LazyProductCard';
import ProductModal from '../components/ProductModal';
import { useProducts } from '../hooks/useProducts';
import { useResetFilters } from '../context/ResetFiltersContext';

// При первом заходе (нет category в URL) не фильтруем по категории — показываем все товары.
// Иначе при пустом category в portal_export получали бы 0 результатов.
function readFiltersFromSearchParams(searchParams) {
  return {
    search: searchParams.get('q') ?? '',
    brand: searchParams.get('brand') ?? '',
    category: searchParams.get('category') ?? '',
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
  };
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, brand, category, page } = readFiltersFromSearchParams(searchParams);

  const { products, loading, error, brands, total, limit, reload } = useProducts({
    search,
    brand,
    category,
    page,
  });

  const { setResetFiltersFn } = useResetFilters();
  const [modalModel, setModalModel] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const onCartToggle = () => setCartOpen((prev) => !prev);

  const updateUrl = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (updates.search !== undefined) next.set('q', updates.search);
      if (updates.brand !== undefined) next.set('brand', updates.brand);
      if (updates.category !== undefined) next.set('category', updates.category);
      if (updates.page !== undefined) next.set('page', String(updates.page));
      return next;
    });
  }, [setSearchParams]);

  const handleFilterChange = useCallback((newFilters) => {
    updateUrl({
      search: newFilters.search ?? '',
      brand: newFilters.brand ?? '',
      category: newFilters.category ?? '',
      page: 1,
    });
  }, [updateUrl]);

  const handleResetFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  useEffect(() => {
    setResetFiltersFn(() => handleResetFilters);
    return () => setResetFiltersFn(null);
  }, [setResetFiltersFn, handleResetFilters]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    updateUrl({ page: nextPage });
  }, [page, updateUrl]);

  const filtersForFilters = { search, brand, category };

  // SEO: динамические title и meta description при смене фильтров (URL)
  const catalogBaseUrl = 'https://grgroup.kz/catalog';
  useEffect(() => {
    const parts = [];
    if (search && search.trim()) parts.push(`поиск: ${search.trim()}`);
    if (brand && brand.trim()) parts.push(`бренд: ${brand.trim()}`);
    if (category && category.trim()) {
      const labels = {
        'ip-cameras': 'IP видеокамеры',
        'ip-recorders': 'IP видеорегистраторы',
        'hd-cameras': 'HD видеокамеры',
        'hd-recorders': 'HD видеорегистраторы',
        'poe-switches': 'PoE коммутаторы',
        'monitors': 'Мониторы',
        'hdd': 'Жесткие диски',
        'cable': 'Кабель UTP',
        'wifi-bridges': 'Радиомосты Wi-Fi',
        'intercoms': 'Видеодомофоны',
        'wifi-ap': 'Wi-Fi точки доступа',
        'rj45': 'RJ45 аксессуары',
        'switches': 'Коммутаторы без PoE',
        'power-supply': 'Блоки питания',
        'mounts': 'Кронштейны',
        'lenses': 'Объективы',
        'ir-illuminators': 'ИК-прожекторы',
        'microphones': 'Микрофоны',
        'speakers': 'Колонки',
        'keyboards': 'Клавиатуры',
        'batteries': 'Аккумуляторы',
        'housings': 'Корпуса',
        'other': 'Прочее',
      };
      parts.push(labels[category] || category);
    }
    const titleSuffix = parts.length ? ` — ${parts.join(', ')}` : '';
    const newTitle = `Каталог${titleSuffix} | G&R Group`;
    document.title = newTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const descSuffix = parts.length ? ` ${parts.join(', ')}.` : '';
      metaDesc.setAttribute('content', `Каталог B2B оборудования${descSuffix} Видеонаблюдение, камеры, регистраторы, коммутаторы. G&R Group, Казахстан.`);
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const params = new URLSearchParams();
      if (search && search.trim()) params.set('q', search.trim());
      if (brand && brand.trim()) params.set('brand', brand.trim());
      if (category && category.trim()) params.set('category', category);
      if (page > 1) params.set('page', String(page));
      const query = params.toString();
      canonical.setAttribute('href', query ? `${catalogBaseUrl}?${query}` : `${catalogBaseUrl}/`);
    }
  }, [search, brand, category, page]);

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
      <div className="container">
        <SmartMarquee products={products} onProductClick={handleCardClick} />
      </div>
      <FloatingActionsBar onCartToggle={onCartToggle} />
      
      <div className="container">
        <Filters 
          brands={brands} 
          onFilterChange={handleFilterChange} 
          onReset={handleResetFilters}
          externalFilters={filtersForFilters}
        />

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
            {products.length === 0 ? (
              <motion.div
                className="no-results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p>😔 Товары не найдены</p>
              </motion.div>
            ) : (
              <>
                <div className="products-grid">
                  {products.map((product, index) => {
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
                {total > 0 && (
                  <motion.div
                    className="pagination"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}
                  >
                    <span className="pagination-info">
                      Показано {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={page <= 1}
                        onClick={() => updateUrl({ page: page - 1 })}
                        style={{
                          padding: '0.5rem 1rem',
                          cursor: page <= 1 ? 'not-allowed' : 'pointer',
                          opacity: page <= 1 ? 0.5 : 1,
                        }}
                      >
                        Назад
                      </button>
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={page * limit >= total}
                        onClick={handleLoadMore}
                        style={{
                          padding: '0.5rem 1rem',
                          cursor: page * limit >= total ? 'not-allowed' : 'pointer',
                          opacity: page * limit >= total ? 0.5 : 1,
                        }}
                      >
                        Вперёд
                      </button>
                    </div>
                  </motion.div>
                )}
              </>
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
        </div>
      </motion.footer>
    </>
  );
}
