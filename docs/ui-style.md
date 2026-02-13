# UI Style Guide — электромонтаж.kz

Редизайн в стиле Evervault: минимализм, технологичность, синий акцент.

## Цветовая палитра

```css
/* Основные / акцент (Evervault-style blue) */
--color-primary: #0a66c2;
--color-primary-hover: #004182;
--color-primary-active: #003366;
--color-accent: #0a66c2;

/* Тёмные секции (hero, footer) */
--color-dark: #0a0a0f;
--color-dark-text: #fafafa;

/* Нейтральные */
--color-bg: #ffffff;
--color-bg-alt: #fafafa;
--color-surface: #f5f5f7;
--color-text: #0a0a0f;
--color-text-muted: #6b7280;
--color-text-light: #9ca3af;
--color-border: #e5e7eb;
--color-border-focus: #0a66c2;
--shadow-card: 0 4px 20px rgba(0,0,0,0.06);
--radius-button: 10px;
--radius-card: 16px;

/* Семантика */
--color-success: #38a169;
--color-error: #e53e3e;
--color-warning: #d69e2e;
```

## Шрифты и размеры

```css
--font-family: "Inter", "Segoe UI", system-ui, sans-serif;
--font-family-heading: "Inter", sans-serif;

/* Размеры */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */
--text-4xl: 2.25rem;  /* 36px */

/* Высота строки */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

## Сетка и контейнеры

```css
--container-max: 1200px;
--container-padding: 1rem;   /* mobile */
--container-padding-md: 1.5rem;
--container-padding-lg: 2rem;

/* Breakpoints (для медиа-запросов) */
/* mobile: < 768px */
/* tablet: 768px–1024px */
/* desktop: >= 1024px */

--gap-section: 3rem;   /* между секциями */
--gap-block: 1.5rem;   /* между блоками внутри секции */
```

## Состояния интерактивных элементов

- **hover**: затемнение/осветление фона, лёгкое изменение цвета (см. переменные `-hover`).
- **focus**: `outline: 2px solid var(--color-border-focus); outline-offset: 2px;` или явный box-shadow.
- **active**: цвет `-active`, при необходимости лёгкое scale или тень.
- **disabled**: `opacity: 0.6`, `cursor: not-allowed`, отключение pointer-events.

Кнопки: скругление `--radius-button: 8px`, padding по макету (например 12px 24px).

## Список базовых UI-компонентов

| Компонент | Назначение |
|-----------|------------|
| **Button** | primary, secondary, outline, link; размеры sm/default/lg |
| **Input** | текст, с label и опциональным error |
| **Textarea** | многострочный ввод |
| **Select** | выпадающий список (нативный или кастомный) |
| **Card** | контент-блок с тенью/бордером и опциональным заголовком |
| **Modal** | overlay + контент, кнопка закрытия |
| **Toast / Notification** | уведомление об успехе/ошибке, авто-закрытие |
| **Accordion** | раскрывающиеся пункты (FAQ) |
| **MainContainer** | обёртка с max-width и горизонтальными отступами |

Все компоненты стилизуются через CSS Modules, без inline-стилей. Глобальные переменные подключаются из `shared/styles/variables.css`.
