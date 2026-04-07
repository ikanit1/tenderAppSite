/**
 * Генератор sitemap.xml для grgroup.kz
 * Запуск: node scripts/generate-sitemap.js
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOMAIN = 'https://grgroup.kz';

// Конфигурация страниц
const pages = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: 1.0,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/services',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/projects',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/smart-systems',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/digital-ecosystem',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/work',
    changefreq: 'monthly',
    priority: 0.7,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/calculator',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/contacts',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: new Date().toISOString().split('T')[0],
  },
  {
    path: '/catalog',
    changefreq: 'weekly',
    priority: 0.8,
    lastmod: new Date().toISOString().split('T')[0],
  },
];

// Генерация XML
function generateSitemap() {
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${DOMAIN}${page.path}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;

  return sitemap;
}

// Запись файла
try {
  const sitemap = generateSitemap();
  const publicPath = resolve(__dirname, '../public/sitemap.xml');

  writeFileSync(publicPath, sitemap, 'utf-8');
  console.log('✅ Sitemap успешно сгенерирован: public/sitemap.xml');
  console.log(`📊 Количество URL: ${pages.length}`);
  console.log(`🌐 Домен: ${DOMAIN}`);
} catch (error) {
  console.error('❌ Ошибка при генерации sitemap:', error);
  process.exit(1);
}
