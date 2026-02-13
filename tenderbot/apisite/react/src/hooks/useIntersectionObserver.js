import { useState, useEffect, useRef } from 'react';

/**
 * Кастомный хук для отслеживания видимости элемента через Intersection Observer API
 * @param {Object} options - Опции для Intersection Observer
 * @param {number} options.threshold - Порог видимости (0-1)
 * @param {string} options.rootMargin - Отступы от корневого элемента
 * @returns {Array} [ref, isIntersecting] - ref для элемента и флаг видимости
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '100px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin, hasIntersected]);

  return [elementRef, isIntersecting, hasIntersected];
}
