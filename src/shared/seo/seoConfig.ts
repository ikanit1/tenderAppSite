export const siteConfig = {
  name: 'GR Group',
  defaultDescription: 'Монтаж систем безопасности, видеонаблюдения, слаботочных систем в Казахстане',
  domain: 'https://grgroup.kz',
  locale: 'ru_RU',
};

export function getCanonicalUrl(pathname: string): string {
  return `${siteConfig.domain}${pathname}`;
}

export function getImageUrl(image: string): string {
  if (image.startsWith('http')) return image;
  return `${siteConfig.domain}${image.startsWith('/') ? '' : '/'}${image}`;
}

interface PageSEO {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  ogType?: 'website' | 'article' | 'product';
}

export const pageSEOConfig: Record<string, PageSEO> = {
  home: {
    title: 'GR Group — Системы безопасности в Казахстане',
    description: 'Монтаж систем видеонаблюдения, СКУД, пожарной сигнализации, слаботочных систем. Работаем по всему Казахстану.',
    keywords: ['системы безопасности', 'видеонаблюдение', 'слаботочные системы', 'СКУД', 'Казахстан'],
  },
  services: {
    title: 'Услуги — GR Group',
    description: 'Полный спектр услуг: видеонаблюдение, СКУД, пожарная сигнализация, слаботочные системы, умный дом.',
    keywords: ['услуги', 'видеонаблюдение', 'слаботочные системы', 'монтаж систем безопасности'],
  },
  calculator: {
    title: 'Калькулятор систем безопасности — GR Group',
    description: 'Рассчитайте стоимость системы видеонаблюдения и домофонии для вашего объекта онлайн.',
    keywords: ['калькулятор', 'расчёт стоимости', 'видеонаблюдение', 'домофония'],
  },
  contacts: {
    title: 'Контакты — GR Group',
    description: 'Свяжитесь с нами: телефон, email, адрес офиса. Работаем по всему Казахстану.',
    keywords: ['контакты', 'телефон', 'адрес', 'GR Group'],
  },
  projects: {
    title: 'Наши проекты — GR Group',
    description: 'Реализованные проекты по монтажу систем безопасности и слаботочных систем.',
    keywords: ['проекты', 'портфолио', 'реализованные объекты'],
  },
  work: {
    title: 'Как мы работаем — GR Group',
    description: 'Этапы работы: от заявки до сдачи объекта. Прозрачный процесс и гарантия качества.',
    keywords: ['как работаем', 'этапы работы', 'процесс монтажа'],
  },
  smartSystems: {
    title: 'Умные системы — GR Group',
    description: 'Интеграция умного дома, автоматизация зданий, IoT-решения для бизнеса и жилья.',
    keywords: ['умный дом', 'автоматизация', 'IoT', 'умные системы'],
  },
  digitalEcosystem: {
    title: 'Цифровая экосистема — GR Group',
    description: 'Комплексные цифровые решения для жилых комплексов: приложение, домофония, видеонаблюдение.',
    keywords: ['цифровая экосистема', 'умный ЖК', 'цифровой ЖК'],
  },
};
