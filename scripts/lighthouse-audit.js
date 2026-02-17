#!/usr/bin/env node
/**
 * Run Lighthouse for all public pages of grgroup.kz.
 * Usage: node scripts/lighthouse-audit.js [--local]
 *   --local  use BASE_URL=http://localhost:5173 (main site) and catalog on 8001; requires dev servers running.
 * Without --local: uses https://grgroup.kz
 */

import { spawn } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const reportsDir = path.join(rootDir, 'lighthouse-reports');

const isLocal = process.argv.includes('--local');
const baseUrl = process.env.BASE_URL || (isLocal ? 'http://localhost:5173' : 'https://grgroup.kz');
const catalogUrl = process.env.CATALOG_URL || (isLocal ? 'http://localhost:8001' : 'https://grgroup.kz');

const mainSitePaths = ['/', '/services', '/contacts', '/projects', '/smart-systems', '/digital-ecosystem', '/work'];
const urls = [
  ...mainSitePaths.map((p) => (p === '/' ? baseUrl : `${baseUrl}${p}`)),
  `${catalogUrl}/catalog/`,
];

function slug(url) {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, '') || 'index';
    return p.replace(/^\//, '').replace(/\//g, '-') || 'index';
  } catch {
    return 'page';
  }
}

function runLighthouse(url) {
  return new Promise((resolve, reject) => {
    const name = slug(url);
    const outPath = path.join(reportsDir, `${name}.html`);
    const args = [
      url,
      '--output=html',
      '--output-path=' + outPath,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--quiet',
      '--no-enable-error-reporting',
    ];
    const child = spawn('npx', ['lighthouse', ...args], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve({ url, reportPath: outPath });
      else reject(new Error(`Lighthouse exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function main() {
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  console.log('Lighthouse audit');
  console.log('Base URL:', baseUrl);
  console.log('Catalog URL:', catalogUrl);
  console.log('URLs:', urls.length);
  console.log('');

  const results = [];
  for (const url of urls) {
    process.stdout.write(`  ${url} ... `);
    try {
      const r = await runLighthouse(url);
      results.push({ url, ok: true, path: r.reportPath });
      console.log('OK');
    } catch (e) {
      results.push({ url, ok: false, error: e.message });
      console.log('FAIL:', e.message.slice(0, 80));
    }
  }

  console.log('');
  console.log('Summary:', results.filter((r) => r.ok).length, '/', results.length, 'passed');
  console.log('Reports saved to:', reportsDir);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
