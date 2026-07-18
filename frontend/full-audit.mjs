/**
 * Full browser audit — correct URLs, all sidebar destinations,
 * dialogs, buttons, forms, and console errors.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const SHOTS = 'e:/salon-saas/screenshots/audit2';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(`[${page.url().split('/').pop()}] ${msg.text()}`);
});
page.on('pageerror', err => consoleErrors.push(`[PAGEERROR] ${err.message}`));

const results = [];

async function visit(path, label, checks = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const finalUrl = page.url();
  const is404 = await page.$('.MuiBox-root:has-text("Page Not Found")').catch(() => null);
  const isComingSoon = await page.$('text=coming soon').catch(() => null);
  const grids = await page.$$('.MuiDataGrid-root');
  const svgCharts = await page.$$('[class*="MuiCharts"]');
  await page.screenshot({ path: `${SHOTS}/${label}.png` });

  const status = is404 ? '❌ 404' : isComingSoon ? '🚧 ComingSoon' : '✅ OK';
  const row = { path, label, status, grids: grids.length, charts: svgCharts.length, url: finalUrl };
  results.push(row);
  console.log(`${status} [${label}] grids=${grids.length} charts=${svgCharts.length}`);
  return row;
}

async function clickDialog(openSelector, closeText = 'Cancel', shotName) {
  const btn = page.locator(openSelector).first();
  if (!await btn.isVisible().catch(() => false)) return false;
  await btn.click();
  await page.waitForTimeout(1200);
  if (shotName) await page.screenshot({ path: `${SHOTS}/${shotName}.png` });
  const cancel = page.locator('[role="dialog"] button').filter({ hasText: closeText }).first();
  if (await cancel.isVisible().catch(() => false)) { await cancel.click(); await page.waitForTimeout(600); }
  return true;
}

// ══════════════════════════════════════════════════════════════
// 1. MAIN ROUTES
// ══════════════════════════════════════════════════════════════
console.log('\n──── MAIN ROUTES ────');
await visit('/dashboard',             'dash');
await visit('/appointments',          'appts');
await visit('/calendar',              'calendar');
await visit('/checkin',               'checkin');
await visit('/customers',             'customers');
await visit('/staff',                 'staff');
await visit('/services',              'services');
await visit('/billing',               'billing');
await visit('/inventory/products',    'inv-products');
await visit('/inventory/stock',       'inv-stock');
await visit('/inventory/orders',      'inv-orders');
await visit('/inventory/suppliers',   'inv-suppliers');
await visit('/marketing',             'marketing');
await visit('/reports/revenue',       'rep-revenue');
await visit('/reports/staff',         'rep-staff');
await visit('/reports/services',      'rep-services');
await visit('/reports/customers',     'rep-customers');
await visit('/reports/inventory',     'rep-inventory');
await visit('/notifications',         'notifications');
await visit('/settings',              'settings');
await visit('/customers/memberships', 'memberships');
await visit('/staff/attendance',      'attendance');
await visit('/staff/payroll',         'payroll');

// ══════════════════════════════════════════════════════════════
// 2. INTERACTIVE ELEMENTS — DIALOGS & BUTTONS
// ══════════════════════════════════════════════════════════════
console.log('\n──── INTERACTIVE ELEMENTS ────');

// Appointments — Book dialog
await page.goto(`${BASE}/appointments`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
const bookOpened = await clickDialog('button:has-text("Book Appointment")', 'Cancel', 'dialog-book');
console.log(`Book appointment dialog: ${bookOpened ? '✅ opened+closed' : '⚠️ button not found'}`);

// Customers — Add dialog
await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
const addCustOpened = await clickDialog('button:has-text("Add Customer")', 'Cancel', 'dialog-addcust');
console.log(`Add Customer dialog: ${addCustOpened ? '✅ opened+closed' : '⚠️ button not found'}`);

// Marketing — New Campaign dialog
await page.goto(`${BASE}/marketing`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
const campOpened = await clickDialog('button:has-text("New Campaign")', 'Cancel', 'dialog-campaign');
console.log(`New Campaign dialog: ${campOpened ? '✅ opened+closed' : '⚠️ button not found'}`);

// ══════════════════════════════════════════════════════════════
// 3. SETTINGS TABS
// ══════════════════════════════════════════════════════════════
console.log('\n──── SETTINGS TABS ────');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
const settingsTabs = await page.$$('[role="tab"]');
for (let i = 0; i < settingsTabs.length; i++) {
  const name = await settingsTabs[i].textContent();
  await settingsTabs[i].click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/settings-tab${i}-${name?.trim().replace(/\s+/g, '-')}.png` });
  console.log(`  Settings tab [${name?.trim()}]: ✅`);
}

// ══════════════════════════════════════════════════════════════
// 4. SIDEBAR NAVIGATION — click all top-level items
// ══════════════════════════════════════════════════════════════
console.log('\n──── SIDEBAR NAVIGATION ────');
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
// Expand Inventory submenu and click Products
const invMenu = page.locator('[aria-label="Inventory submenu"]').first();
if (await invMenu.isVisible().catch(() => false)) {
  await invMenu.click();
  await page.waitForTimeout(500);
  const invProductsLink = page.locator('text=Products').first();
  if (await invProductsLink.isVisible().catch(() => false)) {
    await invProductsLink.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    console.log(`  Inventory > Products nav: ${url.includes('/inventory/products') ? '✅' : '⚠️ ' + url}`);
  }
}

// ══════════════════════════════════════════════════════════════
// 5. DASHBOARD CHARTS CHECK
// ══════════════════════════════════════════════════════════════
console.log('\n──── DASHBOARD CHARTS ────');
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);
const lineAxes = await page.$$('[class*="MuiChartsAxis"]');
const barBars = await page.$$('[class*="MuiBarElement"]');
const pieArcs = await page.$$('[class*="MuiPieArc"]');
await page.screenshot({ path: `${SHOTS}/dash-full.png`, fullPage: false });
console.log(`  LineChart axes: ${lineAxes.length}, BarChart bars: ${barBars.length}, PieChart arcs: ${pieArcs.length}`);

// ══════════════════════════════════════════════════════════════
// 6. CONSOLE ERRORS SUMMARY
// ══════════════════════════════════════════════════════════════
console.log('\n──── CONSOLE ERRORS ────');
const unique = [...new Set(consoleErrors)].filter(e =>
  !e.includes('favicon') && !e.includes('ERR_CONNECTION') && !e.includes('WebSocket')
);
if (unique.length === 0) {
  console.log('  ✅ No console errors!');
} else {
  unique.slice(0, 20).forEach(e => console.log('  ❌', e.substring(0, 250)));
}

// ══════════════════════════════════════════════════════════════
// 7. SUMMARY TABLE
// ══════════════════════════════════════════════════════════════
console.log('\n──── RESULTS ────');
const ok = results.filter(r => r.status === '✅ OK').length;
const err = results.filter(r => r.status === '❌ 404').length;
const coming = results.filter(r => r.status === '🚧 ComingSoon').length;
console.log(`OK: ${ok}  404s: ${err}  ComingSoon: ${coming}`);
results.filter(r => r.status !== '✅ OK' && r.status !== '🚧 ComingSoon').forEach(r =>
  console.log(`  ⚠️  ${r.path} → ${r.status}`)
);

await browser.close();
