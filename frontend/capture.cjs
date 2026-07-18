const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const scratchpad = 'C:\\Users\\Deep\\AppData\\Local\\Temp\\claude\\e--salon-saas\\fd0e46dd-d7de-4221-9aa5-a393dfc88edc\\scratchpad';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  const go = async (url, file, wait = 3000) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(scratchpad, file), fullPage: false, timeout: 10000 });
    console.log('✅', file);
  };

  await go('http://localhost:3000/', 's_landing.png', 3500);
  await go('http://localhost:3000/portal', 's_portal.png', 3000);
  await go('http://localhost:3000/book', 's_book.png', 3500);

  // Portal lookup test
  await page.goto('http://localhost:3000/portal', { waitUntil: 'domcontentloaded', timeout: 12000 });
  await page.waitForTimeout(2500);
  await page.fill('input', '+1 310 555 8877');
  await page.getByRole('button', { name: /Find My Bookings/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(scratchpad, 's_portal_result.png'), timeout: 10000 });
  console.log('✅ s_portal_result.png');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
