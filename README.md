# ЭлектроМонтаж — SPA

Миграция сайта [электромонтаж.kz](https://электромонтаж.kz) в одностраничное приложение на React.

## Стек

- **Vite** + **React 18** + **TypeScript**
- **React Router** — маршрутизация
- **CSS Modules** — стили (без Tailwind)
- **React Hook Form** — формы и валидация
- **react-helmet-async** — SEO (title, description)
- **ESLint** + **Prettier**

## Установка и запуск

```bash
npm install
npm run dev    # dev-сервер (обычно http://localhost:5173)
npm run build  # сборка в dist/
npm run preview # просмотр собранного билда
```

## Запуск всего окружения

Из корня репозитория одной командой можно поднять основной сайт, каталог (API + SPA) и Telegram-бота с веб-админкой:

```bash
npm run dev:all
```

**Требования:** Node.js, Python; в `tenderbot` должен быть настроен `.env` (BOT_TOKEN, ADMIN_ID, DATABASE_URL и т.д.); при необходимости — `.env` в `tenderbot/apisite`. Для каталога при первом запросе к 8001 при отсутствии `tenderbot/apisite/react/dist` apisite может выполнить сборку React; иначе заранее выполните `npm install` и `npm run build` в `tenderbot/apisite/react`.

**Порты:**

| Сервис              | URL                      | Описание |
|---------------------|--------------------------|----------|
| Основной сайт (Vite)| http://localhost:5173    | Root site (маркетинг) |
| Каталог и API       | http://localhost:8001    | FastAPI: API + собранный React из `react/dist` |
| Каталог (dev)       | http://localhost:3000    | Vite dev server (опционально, только для hot reload) |
| Веб-админка TenderBot | http://localhost:8000  | TenderBot web interface |

**Логика портов каталога:**

- **Порт 8001** (FastAPI) — основной сервер:
  - Отдает API endpoints и собранный React frontend из `react/dist`
  - Запускается через `npm run dev:apisite`
  - Работает всегда, даже без Vite dev server

- **Порт 3000** (Vite dev) — только для разработки:
  - Hot reload для фронтенда apisite/react
  - Proxy на 8001 для API запросов
  - Запускается отдельно: `npm run dev:apisite:react`
  - **В production не используется** — FastAPI отдает собранный React

Остановка — один `Ctrl+C` по всем процессам.

По отдельности: `npm run dev` (сайт), `npm run dev:apisite` (каталог), `npm run dev:apisite:react` (каталог с hot reload), `npm run dev:bot` (бот + админка).

## Структура проекта

```
src/
  app/              # Роутер, провайдеры, PageMeta (SEO)
  pages/            # Страницы (Home, Services, Prices, Contacts, Calculator)
  widgets/          # Крупные блоки: Layout, Hero, About, Services, Conditions,
                    # CalculatorCta, CalculatorWidget, ContactSection,
                    # AssistantSection, AssistantWidget
  features/         # lead-form (LeadForm), toast (ToastProvider)
  entities/         # Модели данных (lead)
  shared/
    ui/              # UI-kit: Button, Input, Textarea, Select, Card, Modal, Toast, Accordion, MainContainer
    styles/         # variables.css, reset.css, global.css
    content/        # Тексты и конфиги: home, services, prices, contacts, faq, assistant, calculatorConfig
  mock/             # leadApi.mock.ts, assistantApi.mock.ts
docs/
  inventory.md      # Карта сайта, секции, формы, виджеты
  ui-style.md       # Палитра, шрифты, компоненты
```

## Где менять тексты

- **Главная, о компании, hero:** `src/shared/content/home.ts`
- **Услуги:** `src/shared/content/services.ts`
- **Цены и условия:** `src/shared/content/prices.ts`
- **Контакты:** `src/shared/content/contacts.ts`
- **FAQ:** `src/shared/content/faq.ts`
- **ИИ-помощник (примеры, приветствие):** `src/shared/content/assistant.ts`
- **Калькулятор (типы объектов, формулы):** `src/shared/content/calculatorConfig.ts`

## Замена mock API на реальный бэкенд

1. **Заявки (формы):**  
   В `src/mock/leadApi.mock.ts` реализована функция `submitLead(payload)`.  
   Создайте клиент API (например `src/api/leadApi.ts`) с той же сигнатурой и вызывайте реальный endpoint.  
   В `src/features/lead-form/LeadForm.tsx` замените импорт:
   ```ts
   // было
   import { submitLead } from '@/mock/leadApi.mock';
   // станет
   import { submitLead } from '@/api/leadApi';
   ```
   UI и валидация форм менять не нужно.

2. **ИИ-ассистент:**  
   В `src/mock/assistantApi.mock.ts` — `sendAssistantMessage(text): Promise<string>`.  
   Реализуйте аналогичную функцию в `src/api/assistantApi.ts` и замените импорт в `src/widgets/assistant/AssistantWidget.tsx`.

3. **Калькулятор** считает на клиенте по `calculatorConfig.ts`; при необходимости можно заменить вызовом API расчёта сметы.

## Деплой и SPA routing

На хостинге (Vercel, Netlify, nginx и т.д.) настройте перенаправление всех маршрутов на `index.html`, чтобы React Router обрабатывал пути типа `/services`, `/contacts` без 404.

- **Vercel:** в корне создайте `vercel.json` с `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`.
- **Netlify:** в `public` создайте `_redirects` с одной строкой: `/* /index.html 200`.

## Чеклист

- [x] Все страницы перенесены (главная, услуги, цены, контакты, калькулятор)
- [x] Header/Footer с навигацией и контактами
- [x] Формы отправляются через mock, toast «Успешно отправлено»
- [x] Калькулятор считает по конфигу, кнопка «Точный расчёт» открывает форму
- [x] ИИ-ассистент (floating-кнопка, чат с ответами по ключевым словам, fallback → заявка)
- [x] Адаптивная вёрстка (mobile / tablet / desktop)
- [x] Build без ошибок, без Tailwind и без inline-стилей
- [x] SEO: title/description на страницах, robots.txt, sitemap.xml
