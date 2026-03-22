# B2B Catalog React App

React версия каталога товаров B2B.

## Установка

```bash
cd react
npm install
```

## Запуск

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## Структура

- `src/pages/` - страницы приложения (Home, Checkout, Admin)
- `src/components/` - переиспользуемые компоненты
- `src/hooks/` - кастомные хуки (useCart, useProducts)
- `src/index.css` - глобальные стили

## API

Приложение использует прокси для API запросов к бэкенду на `http://localhost:8000`
