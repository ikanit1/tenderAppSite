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
  { to: '/catalog', label: 'Каталог' },
  { to: '/smart-systems', label: 'Умные системы' },
  { to: '/digital-ecosystem', label: 'Цифровая экосистема дома' },
  { to: '/work', label: 'Работа' },
  { to: '/calculator', label: 'Калькулятор' },
  { to: '/contacts', label: 'Контакты' },
];
