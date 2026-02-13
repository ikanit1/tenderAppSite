import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Hero({ products }) {
  const [currentImage, setCurrentImage] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const withImages = products.filter(p => {
      const img = p.image || (p.model ? `/api/products/${encodeURIComponent(p.model)}/image` : null);
      return img;
    });

    if (withImages.length === 0) {
      setCurrentImage(null);
      return;
    }

    // Используем useRef для хранения индекса без пересоздания эффекта
    let indexRef = 0;
    
    const updateImage = () => {
      const index = indexRef % withImages.length;
      const product = withImages[index];
      const url = product.image || `/api/products/${encodeURIComponent(product.model)}/image`;
      setCurrentImage({ url, name: product.name || product.model });
      indexRef = (index + 1) % withImages.length;
      setCurrentIndex(prev => (prev + 1) % withImages.length);
    };

    // Устанавливаем первое изображение сразу
    if (withImages.length > 0) {
      const firstProduct = withImages[0];
      const firstUrl = firstProduct.image || `/api/products/${encodeURIComponent(firstProduct.model)}/image`;
      setCurrentImage({ url: firstUrl, name: firstProduct.name || firstProduct.model });
      setCurrentIndex(1);
      indexRef = 1;
    }
    
    // Запускаем интервал для смены изображений
    const interval = setInterval(updateImage, 5000);
    return () => clearInterval(interval);
  }, [products]); // Убрали currentIndex из зависимостей, используем функциональное обновление

  useEffect(() => {
    const heroCodeSide = document.getElementById('heroCodeSide');
    if (!heroCodeSide) return;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>{}[]()';
    const colCount = 6;
    heroCodeSide.innerHTML = '';
    
    for (let c = 0; c < colCount; c++) {
      const col = document.createElement('div');
      col.className = 'hero-code-column';
      let text = '';
      for (let i = 0; i < 25; i++) {
        text += chars[Math.floor(Math.random() * chars.length)] + '<br>';
      }
      col.innerHTML = text;
      heroCodeSide.appendChild(col);
    }
  }, []);

  return (
    <section className="hero" id="hero" aria-label="Популярные товары">
      <div className="hero-bg">
        <div className="hero-image-side" id="heroImageSide">
          <AnimatePresence mode="wait">
            {currentImage && (
              <motion.img
                key={currentImage.url}
                id="heroImage"
                src={currentImage.url}
                alt={currentImage.name}
                loading="eager"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="hero-glow"></div>
        <div className="hero-code-side" id="heroCodeSide"></div>
      </div>
      <div className="hero-overlay"></div>
    </section>
  );
}
