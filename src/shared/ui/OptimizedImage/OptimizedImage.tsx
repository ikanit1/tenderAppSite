import { ImgHTMLAttributes, useState } from 'react';
import styles from './OptimizedImage.module.css';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  priority?: boolean;
  className?: string;
}

/**
 * Компонент оптимизированного изображения с:
 * - Lazy loading
 * - Responsive images
 * - Placeholder при загрузке
 * - WebP fallback (когда будет настроено)
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  lazy = true,
  priority = false,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Определяем loading strategy
  const loading = priority ? 'eager' : lazy ? 'lazy' : 'eager';

  // TODO: В будущем добавить автоматическую конвертацию в WebP
  // const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp');

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div
      className={`${styles.container} ${className}`}
      style={{
        ...(width && { width: `${width}px` }),
        ...(height && { height: `${height}px` }),
      }}
    >
      {!isLoaded && !hasError && (
        <div className={styles.placeholder} aria-hidden="true">
          <div className={styles.spinner} />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`${styles.image} ${isLoaded ? styles.imageLoaded : ''} ${
          hasError ? styles.imageError : ''
        }`}
        {...props}
      />

      {hasError && (
        <div className={styles.errorPlaceholder} aria-label="Изображение не загрузилось">
          ⚠️
        </div>
      )}
    </div>
  );
}
