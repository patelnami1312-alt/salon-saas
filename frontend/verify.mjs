/**
 * Quick verification: confirm DataGrid, Charts render + capture console errors.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const SHOTS = 'e:/salon-saas/screenshots/audit';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(err.message));

const issues = [];

async function visit(path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

  // Check for DataGrid
  const grids = await page.$$('.MuiDataGrid-root');
  // Check for MUI X Charts SVGs
  const svgs = await page.$$('[class*="MuiCharts"]');
  // Check for visible error banners
  const alerts = await page.$$eval('.MuiAlert-root.MuiAlert-colorError, .MuiAlert-root.MuiAlert-standardError', els =>
    els.map(el => el.textContent?.trim()).filter(Boolean)
  );

  console.log(`[${name}] grids=${grids.length} charts=${svgs.length} errors=${alerts.length}`);
  if (alerts.length) { issues.push({ page: name, alerts }); console.log('  ALERTS:', alerts); }
  return { grids: grids.length, svgs: svgs.length };
}

// ── Pages to verify ────────────────────────────────────────────────────────
console.log('\n--- Visiting pages ---');
await visit('/dashboard',    'v-dashboard');
await visit('/appointments', 'v-appointments');
await visit('/customers',    'v-customers');
await visit('/staff',        'v-staff');
await visit('/inventory',    'v-inventory');
await visit('/billing',      'v-billing');
await visit('/checkin',      'v-checkin');
await visit('/marketing',    'v-marketing');
await visit('/reports',      'v-reports');
await visit('/settings',     'v-settings');
await visit('/calendar',     'v-calendar');

// ── Console error summary ─────────────────────────────────────────────────
console.log('\n--- Console errors ---');
const unique = [...new Set(consoleErrors)].filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
if (unique.length === 0) {
  console.log('  ✅ No console errors!');
} else {
  unique.slice(0, 15).forEach(e => console.log('  ❌', e.substring(0, 250)));
}

console.log('\n--- Issues ---');
if (issues.length === 0) console.log('  ✅ No error alerts found');
else issues.forEach(i => console.log(`  ⚠️  ${i.page}:`, i.alerts));

await browser.close();
