import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];

await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(2000);

// Sidebar open
await page.screenshot({ path: 'e:/salon-saas/screenshots/layout-open.png' });

const open = await page.evaluate(() => {
  const main = document.querySelector('main');
  const r = main?.getBoundingClientRect();
  return { left: Math.round(r?.left ?? 0), width: Math.round(r?.width ?? 0), right: Math.round(r?.right ?? 0) };
});
console.log('Sidebar OPEN  → main left:', open.left, 'width:', open.width, 'right:', open.right);

// Close sidebar
await page.click('button[aria-label*="navigation"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'e:/salon-saas/screenshots/layout-closed.png' });

const closed = await page.evaluate(() => {
  const main = document.querySelector('main');
  const r = main?.getBoundingClientRect();
  return { left: Math.round(r?.left ?? 0), width: Math.round(r?.width ?? 0), right: Math.round(r?.right ?? 0) };
});
console.log('Sidebar CLOSED → main left:', closed.left, 'width:', closed.width, 'right:', closed.right);

// Re-open
await page.click('button[aria-label*="navigation"]');
await page.waitForTimeout(500);

await browser.close();
