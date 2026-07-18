import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

// Visit dashboard
await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);

const url = page.url();
const title = await page.title();
const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500));
const allClasses = await page.$$eval('*', els => [...new Set(els.flatMap(el => [...el.classList]))].filter(c => c.startsWith('Mui')).slice(0, 30));

console.log('URL:', url);
console.log('Title:', title);
console.log('Body text sample:', bodyText.replace(/\n+/g, ' ').substring(0, 300));
console.log('MUI classes found:', allClasses);

// Also take screenshot
await page.screenshot({ path: 'e:/salon-saas/screenshots/audit/debug-current.png' });
console.log('Screenshot saved');

await browser.close();
