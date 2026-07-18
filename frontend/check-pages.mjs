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
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`[${page.url()}] ${msg.text()}`); });

// ── Check Inventory ────────────────────────────────────────────────────────
console.log('=== INVENTORY ===');
await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/inv-products.png` });

const invProductsGrid = await page.$$('.MuiDataGrid-root');
console.log(`Products tab DataGrid count: ${invProductsGrid.length}`);

// Click Stock Levels tab
const stockTab = page.locator('[role="tab"]').filter({ hasText: /Stock/i });
if (await stockTab.isVisible()) {
  await stockTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/inv-stock.png` });
  const stockGrid = await page.$$('.MuiDataGrid-root');
  console.log(`Stock tab DataGrid count: ${stockGrid.length}`);
}

// ── Check Reports ──────────────────────────────────────────────────────────
console.log('\n=== REPORTS ===');
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3500);
await page.screenshot({ path: `${SHOTS}/rep-revenue.png` });

const revGrids = await page.$$('.MuiDataGrid-root');
console.log(`Revenue tab DataGrid count: ${revGrids.length}`);

// Staff tab
const staffTab = page.locator('[role="tab"]').filter({ hasText: /Staff/i });
if (await staffTab.isVisible()) {
  await staffTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/rep-staff.png` });
  const sg = await page.$$('.MuiDataGrid-root');
  console.log(`Staff tab DataGrid count: ${sg.length}`);
}

// Services tab
const svcTab = page.locator('[role="tab"]').filter({ hasText: /Service/i }).first();
if (await svcTab.isVisible()) {
  await svcTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/rep-services.png` });
  const sg2 = await page.$$('.MuiDataGrid-root');
  console.log(`Services tab DataGrid count: ${sg2.length}`);
}

// ── Check Appointments dialog with DatePicker ─────────────────────────────
console.log('\n=== APPOINTMENTS DIALOG ===');
await page.goto(`${BASE}/appointments`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);

const bookBtn = page.locator('button').filter({ hasText: 'Book Appointment' });
if (await bookBtn.isVisible()) {
  await bookBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/appts-dialog.png` });
  const datePicker = await page.$$('.MuiDateCalendar-root, [class*="DatePicker"], input[placeholder*="MM/DD" i], input[placeholder*="date" i]');
  const timePicker = await page.$$('[class*="TimePicker"], input[placeholder*="hh:mm" i]');
  console.log(`DatePicker elements: ${datePicker.length}, TimePicker elements: ${timePicker.length}`);
  // Close
  const cancel = page.locator('[role="dialog"] button').filter({ hasText: 'Cancel' });
  if (await cancel.isVisible()) await cancel.click();
}

// ── Dashboard charts ───────────────────────────────────────────────────────
console.log('\n=== DASHBOARD CHARTS ===');
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/dash-charts.png` });

const lineCharts = await page.$$('[class*="MuiChartsAxis"]');
const barCharts = await page.$$('[class*="MuiBarElement"]');
const pieCharts = await page.$$('[class*="MuiPieArc"]');
console.log(`LineChart axes: ${lineCharts.length}, BarChart bars: ${barCharts.length}, PieChart arcs: ${pieCharts.length}`);

// ── Console errors ─────────────────────────────────────────────────────────
console.log('\n=== CONSOLE ERRORS ===');
const unique = [...new Set(consoleErrors)].filter(e => !e.includes('favicon'));
if (unique.length === 0) console.log('✅ None');
else unique.slice(0, 10).forEach(e => console.log('❌', e.substring(0, 200)));

await browser.close();
