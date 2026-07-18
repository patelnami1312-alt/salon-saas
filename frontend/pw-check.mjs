import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];

await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(1000);

// Screenshot current state (dashboard)
await page.screenshot({ path: 'e:/salon-saas/screenshots/i18n-dashboard.png' });
console.log('Screenshot saved: i18n-dashboard.png');

// Check for any remaining ₹ in the visible text
const rupeeCount = await page.evaluate(() => {
  return document.body.innerText.split('₹').length - 1;
});
console.log('Visible ₹ symbols on page:', rupeeCount);

// Check Settings page
await page.goto('http://localhost:3000/settings', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// Click Salon tab
const tabs = page.locator('[role="tab"]');
await tabs.nth(1).click();
await page.waitForTimeout(800);

await page.screenshot({ path: 'e:/salon-saas/screenshots/i18n-settings.png' });
console.log('Screenshot saved: i18n-settings.png');

// Check if currency dropdown exists
const currencyLabel = await page.locator('text=Currency').first().isVisible();
console.log('Currency selector visible:', currencyLabel);

const timezoneLabel = await page.locator('text=Timezone').first().isVisible();
console.log('Timezone selector visible:', timezoneLabel);

await browser.close();
console.log('Done.');
