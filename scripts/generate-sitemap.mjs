#!/usr/bin/env node
/**
 * Генерирует public/sitemap.xml для grgroup.kz:
 *   - все статические маркетинговые страницы (HomePage, Services, Projects, ...)
 *   - все товары каталога из tenderbot/apisite/portal_export/<model>/product.json
 *
 * Запускается автоматически перед `npm run build`.
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://grgroup.kz';
const CATALOG_DIR = join(ROOT, 'tenderbot', 'apisite', 'portal_export');
const OUTPUT = join(ROOT, 'public', 'sitemap.xml');

const today = new Date().toISOString().slice(0, 10);

const STATIC_PAGES = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE}/services`, priority: '0.9', changefreq: 'monthly' },
  { loc: `${SITE}/projects`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/smart-systems`, priority: '0.85', changefreq: 'monthly' },
  { loc: `${SITE}/digital-ecosystem`, priority: '0.85', changefreq: 'monthly' },
  { loc: `${SITE}/work`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${SITE}/calculator`, priority: '0.85', changefreq: 'monthly' },
  { loc: `${SITE}/contacts`, priority: '0.9', changefreq: 'monthly' },
  { loc: `${SITE}/catalog/`, priority: '0.95', changefreq: 'weekly' },
];

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readProducts() {
  if (!existsSync(CATALOG_DIR)) {
    console.warn(`[sitemap] Каталог товаров не найден: ${CATALOG_DIR}`);
    return [];
  }
  const products = [];
  const entries = readdirSync(CATALOG_DIR);
  for (const entry of entries) {
    const folder = join(CATALOG_DIR, entry);
    let st;
    try {
      st = statSync(folder);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const productJson = join(folder, 'product.json');
    if (!existsSync(productJson)) continue;
    try {
      const data = JSON.parse(readFileSync(productJson, 'utf-8'));
      const model = (data.model || entry).trim();
      if (!model) continue;
      products.push({
        model,
        name: data.name || model,
        images: Array.isArray(data.images) ? data.images : [],
      });
    } catch (err) {
      // повреждённый JSON — пропускаем
    }
  }
  return products;
}

function buildSitemap(products) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  for (const page of STATIC_PAGES) {
    lines.push(
      '  <url>',
      `    <loc>${page.loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    );
  }

  for (const p of products) {
    const encoded = encodeURIComponent(p.model);
    const loc = `${SITE}/catalog/?model=${encoded}`;
    lines.push(
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      '    <priority>0.6</priority>',
    );
    if (p.images && p.images.length > 0) {
      const imgUrl = `${SITE}/catalog/portal_export/${encoded}/${p.images[0]}`;
      lines.push(
        '    <image:image>',
        `      <image:loc>${escapeXml(imgUrl)}</image:loc>`,
        `      <image:title>${escapeXml(p.name.slice(0, 120))}</image:title>`,
        '    </image:image>',
      );
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

const products = readProducts();
const sitemap = buildSitemap(products);
writeFileSync(OUTPUT, sitemap, 'utf-8');
console.log(
  `[sitemap] Записано ${OUTPUT} — ${STATIC_PAGES.length} страниц + ${products.length} товаров`,
);
