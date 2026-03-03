import { getMainSiteUrl } from './siteUrl';

export function getCatalogNavItems() {
  const base = getMainSiteUrl().replace(/\/$/, '');
  return [
    { href: `${base}/`, label: 'Главная', isCatalog: false },
    { href: `${base}/services`, label: 'Услуги', isCatalog: false },
    { href: `${base}/projects`, label: 'Проекты', isCatalog: false },
    { href: '/', label: 'Каталог', isCatalog: true },
    { href: `${base}/smart-systems`, label: 'Умные системы', isCatalog: false },
    { href: `${base}/digital-ecosystem`, label: 'Цифровая экосистема дома', isCatalog: false },
    { href: `${base}/work`, label: 'Работа', isCatalog: false },
    { href: `${base}/calculator`, label: 'Калькулятор', isCatalog: false },
    { href: `${base}/contacts`, label: 'Контакты', isCatalog: false },
  ];
}
