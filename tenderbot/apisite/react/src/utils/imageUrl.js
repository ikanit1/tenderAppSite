/**
 * Утилита для генерации URL изображений товаров с правильной обработкой специальных символов
 * Обеспечивает корректное кодирование моделей с кириллицей, скобками, пробелами и другими символами
 */

/**
 * Генерирует URL изображения товара с правильным кодированием специальных символов
 * @param {Object} product - Объект товара
 * @param {string} product.model - Модель товара
 * @param {string} product.image - Готовый URL изображения (если есть)
 * @returns {string|null} URL изображения или null
 */
export function generateImageUrl(product) {
  if (!product) return null;
  
  const model = (product.model != null ? String(product.model) : '').trim();
  
  // Если есть готовый URL изображения из API, используем его
  if (product.image) {
    if (product.image.startsWith('/')) return product.image;
    if (product.image.startsWith('http')) {
      if (model) return `/api/products/${encodeURIComponent(model)}/image`;
      return product.image;
    }
    return product.image.startsWith('/') ? product.image : '/' + product.image;
  }
  
  // Генерируем URL с правильным кодированием всех специальных символов
  if (model) {
    // encodeURIComponent корректно кодирует все специальные символы:
    // - Скобки: ( ) → %28 %29
    // - Пробелы: → %20
    // - Кириллица: фиолетовый → %D1%84%D0%B8%D0%BE%D0%BB%D0%B5%D1%82%D0%BE%D0%B2%D1%8B%D0%B9
    // - Специальные символы: / → %2F
    const encodedModel = encodeURIComponent(model);
    return `/api/products/${encodedModel}/image`;
  }
  
  return null;
}

/**
 * Генерирует альтернативные варианты URL для fallback при ошибке загрузки
 * @param {string} model - Модель товара
 * @returns {string[]} Массив альтернативных URL
 */
export function generateAlternativeImageUrls(model) {
  if (!model) return [];
  
  const modelStr = String(model).trim();
  const alternatives = [];
  
  // Вариант 1: Стандартное кодирование
  alternatives.push(encodeURIComponent(modelStr));
  
  // Вариант 2: Без двойного кодирования (если скобки уже закодированы)
  const modelNoDoubleEncode = modelStr.replace(/%28/g, '(').replace(/%29/g, ')');
  if (modelNoDoubleEncode !== modelStr) {
    alternatives.push(encodeURIComponent(modelNoDoubleEncode));
  }
  
  // Вариант 3: Замена пробелов на подчеркивания (для совместимости с некоторыми системами)
  const modelWithUnderscores = modelStr.replace(/\s+/g, '_');
  if (modelWithUnderscores !== modelStr) {
    alternatives.push(encodeURIComponent(modelWithUnderscores));
  }
  
  return alternatives.map(encoded => `/api/products/${encoded}/image`);
}
