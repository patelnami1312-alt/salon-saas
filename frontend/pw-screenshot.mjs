import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const OUT = 'e:/salon-saas/screenshots';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const shot = async (name) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✅ ${name}.png`);
};

// 1. Login page — wait for the form to appear
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
await shot('01-login');

// 2. Fill login form
await page.fill('input[type="email"]', 'admin@salonsaas.com');
await page.fill('input[type="password"]', 'Admin@12345');
await shot('02-login-filled');

await page.click('button[type="submit"]');

// Wait for dashboard to load
try {
  await page.waitForURL('**/dashboard', { timeout: 12000 });
  await page.waitForSelector('h5, h4', { timeout: 8000 });
} catch (e) {
  console.log('Dashboard wait timed out, taking screenshot anyway');
}
await shot('03-dashboard');

// 3. Navigate sidebar pages
const routes = [
  ['appointments', '04-appointments'],
  ['checkin', '05-checkin'],
  ['customers', '06-customers'],
  ['billing', '07-billing'],
  ['reports/revenue', '08-reports'],
  ['settings', '09-settings'],
];

for (const [path, name] of routes) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1500);
  await shot(name);
}

await browser.close();
console.log('\nAll screenshots saved to e:/salon-saas/screenshots/');
