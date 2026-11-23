#!/usr/bin/env node
/* Optional browser smoke test (needs Playwright + Chromium):
 *   node scripts/smoke_test.js out/R1.html [out/shot.png]
 * Loads the page with software WebGL, waits 8 s, prints JS errors and the KPI card text,
 * saves a screenshot. Exit code 1 if any page error was seen or the KPI cards are still "—".
 */
const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP: playwright not installed'); process.exit(0); }
(async () => {
  const file = path.resolve(process.argv[2]); const shot = process.argv[3] || file.replace(/\.html$/, '.png');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1140 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + file); await p.waitForTimeout(8000);
  const kpis = await p.$$eval('.card .v', els => els.map(e => e.textContent.trim()));
  await p.screenshot({ path: shot });
  console.log(JSON.stringify({ errors: errs, kpis, screenshot: shot }, null, 1));
  await b.close();
  process.exit(errs.length || kpis.every(t => t.startsWith('—')) ? 1 : 0);
})();
