import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

(async () => {
  mkdirSync('e:/salon-saas/frontend/verify_shots', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@salonsaas.com');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 12000 });
  await page.waitForTimeout(2000);

  const pages = [
    ['dashboard', '/dashboard'],
    ['billing', '/billing'],
    ['calendar', '/calendar'],
    ['reports', '/reports/revenue'],
    ['settings', '/settings'],
    ['inventory', '/inventory/products'],
  ];

  for (const [name, route] of pages) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() =>
      !document.querySelector('.MuiCircularProgress-root') ||
      document.querySelectorAll('.MuiCard-root, .MuiDataGrid-root, .fc').length > 0,
      { timeout: 8000 }
    ).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `e:/salon-saas/frontend/verify_shots/final-${name}.png` });
    console.log(`✅ ${name} screenshot saved`);
  }

  await browser.close();
})().catch(console.error);
