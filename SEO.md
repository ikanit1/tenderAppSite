# SEO Документация для grgroup.kz

## 📊 Обзор

Этот документ описывает полную SEO-настройку сайта elektromontazh.kz (grgroup.kz), включая мета-теги, структурированные данные, оптимизацию производительности и рекомендации по дальнейшему улучшению.

---

## ✅ Реализованные оптимизации

### 1. **Meta-теги и Open Graph**

#### index.html
Базовый HTML содержит:
- ✅ Title, description, keywords
- ✅ Google Search Console verification placeholder
- ✅ Canonical URL
- ✅ Open Graph теги (Facebook)
- ✅ Twitter Card теги
- ✅ Geo-метатеги (Астана, Казахстан)
- ✅ Favicon и Apple touch icon
- ✅ Theme color

#### Динамические мета-теги (React Helmet)
Компонент `PageMeta` ([src/app/PageMeta.tsx](src/app/PageMeta.tsx:1)) автоматически добавляет на каждую страницу:
- Title с правильным форматированием
- Description
- Keywords (опционально)
- Canonical URL
- Open Graph теги
- Twitter Card теги
- Custom изображения для страниц

### 2. **Структурированные данные (JSON-LD)**

Реализовано в [src/shared/seo/StructuredData.tsx](src/shared/seo/StructuredData.tsx:1):

#### Главная страница
- `Organization` + `LocalBusiness` schema
- `WebSite` с SearchAction
- Контактные данные
- Адрес и координаты
- Часы работы

#### Страница услуг
- `Service` schema для каждой услуги
- Pricing information
- Service area (Казахстан)

#### Все страницы
- `BreadcrumbList` для навигации
- `WebPage` schema

### 3. **Конфигурация SEO**

Файл [src/shared/seo/seoConfig.ts](src/shared/seo/seoConfig.ts:1) содержит:
- Централизованные настройки сайта
- SEO-параметры для каждой страницы
- Утилиты для генерации canonical URLs
- Helper функции

#### Страницы с SEO-оптимизацией:
- ✅ Главная (`/`)
- ✅ Услуги (`/services`)
- ✅ Проекты (`/projects`)
- ✅ Контакты (`/contacts`)
- ✅ Умные системы (`/smart-systems`)
- ✅ Цифровая экосистема (`/digital-ecosystem`)
- ✅ Как мы работаем (`/work`)
- ✅ Калькулятор (`/calculator`)
- ✅ Каталог (`/catalog`)

### 4. **Sitemap и Robots**

#### sitemap.xml
- ✅ [public/sitemap.xml](public/sitemap.xml:1) — все страницы
- ✅ Включены lastmod, changefreq, priority
- ✅ Генератор: [scripts/generate-sitemap.js](scripts/generate-sitemap.js:1)
- Запуск: `node scripts/generate-sitemap.js`

#### robots.txt
- ✅ [public/robots.txt](public/robots.txt:1)
- Правильный домен: `https://grgroup.kz`
- Disallow для admin, api, checkout
- Crawl-delay: 1

### 5. **Оптимизация изображений**

Компонент `OptimizedImage` ([src/shared/ui/OptimizedImage/OptimizedImage.tsx](src/shared/ui/OptimizedImage/OptimizedImage.tsx:1)):
- ✅ Lazy loading
- ✅ Placeholder при загрузке
- ✅ Error handling
- ✅ Responsive images
- 🔄 WebP support (TODO: настроить конвертацию)

---

## 🔴 Критические задачи (требуют выполнения)

### 1. Google Search Console
```html
<!-- index.html, строка 14 -->
<meta name="google-site-verification" content="REPLACE_WITH_YOUR_CODE" />
```

**Шаги:**
1. Зарегистрируйтесь в [Google Search Console](https://search.google.com/search-console)
2. Добавьте домен `grgroup.kz`
3. Выберите метод верификации "HTML tag"
4. Замените `REPLACE_WITH_YOUR_CODE` на реальный код
5. Пересоберите и задеплойте

### 2. Контактные данные

Файлы с placeholder данными:
- `index.html` — телефон: `+7-XXX-XXX-XXXX`
- [src/shared/seo/seoConfig.ts](src/shared/seo/seoConfig.ts:1) — адрес, координаты
- [src/shared/seo/StructuredData.tsx](src/shared/seo/StructuredData.tsx:1) — все LocalBusiness поля

**Обновите:**
- Телефон (в 3 файлах)
- Физический адрес офиса
- Координаты (latitude, longitude)
- Социальные сети (`sameAs` array)

### 3. Изображения для Open Graph

Создайте OG-изображения (1200×630px):
- `/og-home.png` — главная
- `/og-services.png` — услуги
- `/og-projects.png` — проекты
- и т.д.

Обновите в [src/shared/seo/seoConfig.ts](src/shared/seo/seoConfig.ts:1):
```typescript
image: '/og-services.png',
```

---

## 🟡 Рекомендации (высокий приоритет)

### 1. Google Analytics / Tag Manager

Добавьте в `index.html` перед `</head>`:

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');</script>
<!-- End Google Tag Manager -->
```

И после `<body>`:
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

### 2. Yandex Metrika

```html
<!-- Yandex.Metrika counter -->
<script type="text/javascript" >
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(XXXXXX, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });
</script>
```

### 3. Оптимизация изображений

#### Конвертация в WebP
```bash
# Установите sharp
npm install sharp --save-dev

# Создайте скрипт scripts/convert-images-to-webp.js
# Конвертируйте все PNG/JPG в WebP
```

#### Минимизация существующих
```bash
# Используйте imagemin
npx imagemin public/*.{jpg,png} --out-dir=public
```

**Текущие проблемы:**
- `GR.png` = 120KB (должно быть <50KB)
- `pechat.png` = 268KB (должно быть <100KB)
- Отсутствуют WebP версии

### 4. Performance оптимизация

#### Vite config улучшения
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
        'vendor-ui': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-accordion'],
      },
    },
  },
}
```

#### Preload критических ресурсов
```html
<!-- index.html -->
<link rel="preload" href="/GR.svg" as="image" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
```

### 5. Heading структура (h1-h6)

Добавьте семантические заголовки на каждую страницу:
- ✅ Одно `<h1>` на страницу (в PageMeta title)
- 🔄 Логическая иерархия h2, h3, h4
- 🔄 Описательные заголовки с ключевыми словами

Пример для [src/widgets/services/ServicesSection.tsx](src/widgets/services/ServicesSection.tsx:1):
```tsx
<h1>Услуги электромонтажа и слаботочных систем</h1>
<h2>Электромонтаж квартир и офисов</h2>
<h3>Установка электрощитов</h3>
```

### 6. Alt-теги для изображений

Проверьте все `<img>` теги:
```tsx
// ❌ Плохо
<img src="/logo.png" />

// ✅ Хорошо
<img src="/logo.png" alt="Логотип G&R Group — электромонтаж в Астане" />
```

### 7. Internal linking

Добавьте внутренние ссылки между связанными страницами:
- Услуги → Проекты
- Калькулятор → Каталог
- О компании → Контакты

---

## 🟢 Дополнительные улучшения

### 1. FAQ Schema

Добавьте FAQ на страницы:
```tsx
import { getFAQSchema } from '@/shared/seo/StructuredData';

const faqs = [
  {
    question: 'Сколько стоит электромонтаж квартиры?',
    answer: 'Стоимость электромонтажа квартиры начинается от 1500 ₸/м². Точная цена зависит от площади, сложности работ и используемых материалов.',
  },
];

<StructuredData data={getFAQSchema(faqs)} />
```

### 2. Blog / Статьи

Добавьте раздел блога для:
- Инструкции по выбору оборудования
- Case studies проектов
- SEO-оптимизированные статьи

### 3. Многоязычность

Добавьте казахский язык:
```html
<link rel="alternate" hreflang="ru" href="https://grgroup.kz/" />
<link rel="alternate" hreflang="kk" href="https://grgroup.kz/kk/" />
```

### 4. PWA (Progressive Web App)

Создайте `manifest.json`:
```json
{
  "name": "ТОО G&R Group",
  "short_name": "G&R Group",
  "description": "Электромонтаж и слаботочные системы",
  "theme_color": "#0a001f",
  "background_color": "#ffffff",
  "display": "standalone",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 5. Lighthouse CI

Настройте автоматические проверки:
```bash
npm run lighthouse:audit
```

---

## 🛠️ Инструменты для проверки

### Обязательные
- [Google Search Console](https://search.google.com/search-console) — индексация, ошибки, производительность
- [Google PageSpeed Insights](https://pagespeed.web.dev/) — производительность
- [Schema.org Validator](https://validator.schema.org/) — проверка JSON-LD
- [Open Graph Debugger](https://developers.facebook.com/tools/debug/) — OG теги

### Рекомендуемые
- [Ahrefs Webmaster Tools](https://ahrefs.com/webmaster-tools) — SEO аудит
- [SEMrush](https://www.semrush.com/) — конкуренты, ключевые слова
- [Screaming Frog](https://www.screamingfrogseolibrary.com/) — технический аудит
- [GTmetrix](https://gtmetrix.com/) — производительность

---

## 📝 Чек-лист запуска

- [ ] Заменить Google Search Console verification code
- [ ] Добавить реальный телефон, адрес, координаты
- [ ] Создать OG-изображения 1200×630px
- [ ] Оптимизировать все изображения (WebP, сжатие)
- [ ] Добавить Google Analytics / Tag Manager
- [ ] Добавить Yandex Metrika
- [ ] Проверить все alt-теги изображений
- [ ] Добавить семантические h1-h6 заголовки
- [ ] Настроить SSL сертификат (HTTPS)
- [ ] Протестировать на мобильных устройствах
- [ ] Проверить через Google PageSpeed Insights
- [ ] Проверить структурированные данные через validator.schema.org
- [ ] Отправить sitemap в Google Search Console
- [ ] Настроить 301 редиректы (если меняли домен)
- [ ] Проверить robots.txt в продакшене

---

## 📚 Полезные ссылки

- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Schema.org Documentation](https://schema.org/docs/documents.html)
- [Open Graph Protocol](https://ogp.me/)
- [Web.dev Performance](https://web.dev/explore/fast)

---

## 🆘 Поддержка

При возникновении вопросов обращайтесь к:
- [src/shared/seo/seoConfig.ts](src/shared/seo/seoConfig.ts:1) — конфигурация
- [src/shared/seo/StructuredData.tsx](src/shared/seo/StructuredData.tsx:1) — схемы
- [src/app/PageMeta.tsx](src/app/PageMeta.tsx:1) — мета-теги

**Последнее обновление:** 22 марта 2026
