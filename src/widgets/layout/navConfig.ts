const catalogUrl = import.meta.env.VITE_CATALOG_URL || 'http://localhost:8001';

export interface NavItem {
  to?: string;
  href?: string;
  label: string;
  external?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/services', label: 'Услуги' },
  { to: '/projects', label: 'Проекты' },
  { href: catalogUrl, label: 'Каталог', external: true },
  { to: '/smart-systems', label: 'Умные системы' },
  { to: '/digital-ecosystem', label: 'Цифровая экосистема дома' },
  { to: '/work', label: 'Работа' },
  { to: '/contacts', label: 'Контакты' },
];
