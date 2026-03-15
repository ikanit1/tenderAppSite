#!/usr/bin/env node
/**
 * Аудит цен: сравнение calculatorConfig.ts с каталогом grgroup.kz/catalog/api/products/{model}/detail
 * Запуск: node scripts/audit-calculator-prices.mjs
 */
const CATALOG_BASE = 'https://grgroup.kz/catalog/api/products';

const ITEMS = [
  { name: 'Уличная цилиндрическая 2MP IPC-2122', model: 'IPC-2122-APF28', priceConfig: 14_400 },
  { name: 'Внутренняя купольная 2MP', model: 'IPC-3612-APF28-DL', priceConfig: 15_500 },
  { name: 'Внутренняя купольная 4MP', model: 'IPC-3614-APF28-NB', priceConfig: 21_000 },
  { name: 'АНПР 3MP', model: 'IPC-F842-IRDU', priceConfig: 274_300 },
  { name: 'Лифтовая камера 2MP', model: 'IPC-3612-APF28-DL', priceConfig: 18_500 },
  { name: 'Лифтовая камера 4MP', model: 'IPC-3614-APF28-NB', priceConfig: 26_000 },
  { name: 'WK-WB08-KIT', model: 'WK-WB08-KIT', priceConfig: 24_750 },
  { name: 'CAB-LC2100B-E2-IN (305м)', model: 'CAB-LC2100B-E2-IN', priceConfig: 51_000 },
  { name: 'CAB-LC2110B-IN (305м)', model: 'CAB-LC2110B-IN', priceConfig: 51_700 },
  { name: 'Патч-корд 3м UTP Cat5e', model: null, priceConfig: 1_500 },
  { name: 'SEAGATE SkyHawk AI 10TB', model: 'ST8000VX010', priceConfig: 220_000 },
  { name: 'Расширитель хранения JBOD', model: null, priceConfig: 380_000 },
  { name: 'NVR824-256R', model: 'NVR308-64X', priceConfig: 4_834_500 },
  { name: 'NVR308-64E', model: 'NVR308-64X', priceConfig: 850_000 },
  { name: 'NVR304-32E', model: 'NVR304-32B-IQ', priceConfig: 420_000 },
  { name: 'NVR302-16E', model: 'NVR302-16B-IQ', priceConfig: 195_000 },
  { name: 'WK-PS227GF (24 порта PoE)', model: 'WK-PS227GF', priceConfig: 69_500 },
  { name: 'WK-PS216GF (16 портов PoE)', model: 'WK-PS216GF', priceConfig: 52_000 },
  { name: 'WK-PS208GF (8 портов PoE)', model: 'WK-PS208GF', priceConfig: 35_000 },
  { name: 'Коммутатор управляемый 24п (аплинк)', model: 'NS-1010-8GT', priceConfig: 45_000 },
  { name: 'Шкаф 42U', model: null, priceConfig: 380_000 },
  { name: 'SHIP 601S.6027.24.100 (27U)', model: 'SHIP-601S-6027-24-100', priceConfig: 283_773 },
  { name: 'Шкаф 18U', model: null, priceConfig: 165_000 },
  { name: 'ИБП 1 кВА (600 Вт)', model: null, priceConfig: 85_000 },
  { name: 'ИБП 2 кВА (1200 Вт)', model: null, priceConfig: 165_000 },
  { name: 'ИБП 3 кВА (1800 Вт)', model: null, priceConfig: 247_990 },
  { name: 'SHIP 700402112T (вентиляторы)', model: 'SHIP 700402112T', priceConfig: 30_397 },
  { name: 'SHIP 701402120 (органайзер)', model: 'SHIP 701402120', priceConfig: 3_279 },
  { name: 'SHIP 700508102 (PDU 8 розеток)', model: 'SHIP 700508102', priceConfig: 12_324 },
  { name: 'Патч-панель 24 порта', model: null, priceConfig: 8_500 },
  { name: 'Патч-панель 48 портов', model: null, priceConfig: 14_200 },
  { name: 'MW3255-F-V2 (55" 4K)', model: 'MW3255-F-V2', priceConfig: 363_700 },
  { name: 'Вызывная панель IP', model: 'C313S', priceConfig: 85_000 },
  { name: 'Считыватель карт', model: 'DS-K1102AEM', priceConfig: 25_000 },
  { name: 'Контроллер доступа', model: 'GVAE11', priceConfig: 35_000 },
  { name: 'PoE 4-порт (этаж)', model: 'WK-PS204GF', priceConfig: 22_000 },
  { name: 'PoE 8-порт (этаж)', model: 'WK-PS208GF', priceConfig: 35_000 },
  { name: 'Вызывная панель (вход)', model: 'OEU-201S-HMK-W', priceConfig: 250_000 },
  { name: 'WK-PS204GF (4 порта PoE)', model: 'WK-PS204GF', priceConfig: 22_000 },
  { name: 'WK-PS232GF (32 порта PoE)', model: 'WK-PS232GF', priceConfig: 75_000 },
  { name: 'WK-PS264GF (64 порта PoE)', model: 'WK-PS264GF', priceConfig: 130_000 },
];

async function fetchDetail(model) {
  const url = `${CATALOG_BASE}/${encodeURIComponent(model)}/detail`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function status(diffPct, found) {
  if (!found) return '❌ Обновить';
  const pct = Math.abs(diffPct);
  if (pct <= 5) return '✅ OK';
  if (pct <= 20) return '⚠️ Проверить';
  return '❌ Обновить';
}

async function main() {
  const rows = [];
  for (const item of ITEMS) {
    const model = item.model;
    const name = item.name;
    const priceConfig = item.priceConfig;
    let priceCatalog = null;
    let found = false;
    if (model) {
      const data = await fetchDetail(model);
      if (data && (data.final_price != null || data.price_rrc != null)) {
        const p = data.final_price ?? data.price_rrc;
        if (p > 0) {
          priceCatalog = p;
          found = true;
        }
      }
    }
    const diff = priceCatalog != null ? priceCatalog - priceConfig : null;
    const diffPct = diff != null && priceCatalog ? (diff / priceCatalog) * 100 : null;
    const st = status(diffPct, found);
    rows.push({
      model: model || '—',
      name,
      priceConfig,
      priceCatalog: priceCatalog ?? '—',
      diff: diff != null ? diff : '—',
      diffPct: diffPct != null ? diffPct.toFixed(1) + '%' : '—',
      status: st,
      found,
    });
  }

  console.log('| Модель | Название | Цена в конфиге | Цена в каталоге | Разница | % | Статус |');
  console.log('|--------|----------|----------------|-----------------|---------|---|--------|');
  for (const r of rows) {
    const cfg = r.priceConfig.toLocaleString('ru-RU');
    const cat = r.priceCatalog === '—' ? '—' : Number(r.priceCatalog).toLocaleString('ru-RU');
    const d = r.diff === '—' ? '—' : (r.diff >= 0 ? '+' : '') + r.diff.toLocaleString('ru-RU');
    console.log(`| ${r.model} | ${r.name.slice(0, 30)} | ${cfg} | ${cat} | ${d} | ${r.diffPct} | ${r.status} |`);
  }

  const ok = rows.filter((r) => r.status === '✅ OK').length;
  const warn = rows.filter((r) => r.status === '⚠️ Проверить').length;
  const bad = rows.filter((r) => r.status === '❌ Обновить').length;
  const notInCatalog = rows.filter((r) => !r.found && r.model !== '—').concat(rows.filter((r) => r.model === '—'));

  console.log('\n## Итог\n');
  console.log('- **✅ OK:** ' + ok);
  console.log('- **⚠️ Проверить:** ' + warn);
  console.log('- **❌ Обновить:** ' + bad);
  console.log('- **Нет в каталоге / без модели:** ' + notInCatalog.length + ' — ' + notInCatalog.map((r) => r.name).join('; '));

  const withPct = rows.filter((r) => r.found && r.diffPct !== '—').map((r) => ({ ...r, pct: parseFloat(r.diffPct) }));
  withPct.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  console.log('\n### Топ-5 расхождений по %\n');
  withPct.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}: конфиг ${r.priceConfig}, каталог ${r.priceCatalog}, ${r.diffPct} — ${r.status}`);
  });

  const toUpdate = rows.filter(
    (r) => r.status === '❌ Обновить' && r.found && r.priceCatalog > 0
  );
  const skipCrossModel = (r) => r.name.includes('NVR824-256R'); // в каталоге нет 256кан., сравнивали с NVR308-64X
  if (toUpdate.length) {
    console.log('\n### Готовые правки для calculatorConfig.ts (только ❌ Обновить, та же модель в каталоге)\n');
    toUpdate.filter((r) => !skipCrossModel(r)).forEach((r) => {
      console.log(`// ${r.name}: было ${r.priceConfig}, каталог ${r.priceCatalog}`);
      console.log(`priceKzt: ${r.priceConfig} → ${Math.round(r.priceCatalog)}  // ${r.model}`);
    });
    if (toUpdate.some(skipCrossModel)) {
      console.log('\n// NVR824-256R: в каталоге нет 256-канальной модели; цена NVR308-64X (64 кан.) — только для справки, в конфиг не подставлять.');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
