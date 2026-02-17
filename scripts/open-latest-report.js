#!/usr/bin/env node
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.join(__dirname, '..', 'lighthouse-reports');

if (!existsSync(reportsDir)) {
  console.log('No reports directory. Run: npm run lighthouse:audit');
  process.exit(1);
}
const files = readdirSync(reportsDir).filter((f) => f.endsWith('.html')).sort();
const latest = files.pop();
if (!latest) {
  console.log('No HTML reports. Run: npm run lighthouse:audit');
  process.exit(1);
}
const fullPath = path.join(reportsDir, latest);
const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
spawn(open, [fullPath], { detached: true, stdio: 'ignore' }).unref();
console.log('Opened:', fullPath);
