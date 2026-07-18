import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAdmin(page: any) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').first().fill('admin@salonsaas.com');
  await page.locator('input[type="password"]').first().fill('Admin@12345');
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
  await page.waitForURL(/admin/, { timeout: 10000 });
  console.log(`Logged in, URL: ${page.url()}`);
}

test('debug: super admin salons page', async ({ page }) => {
  const errors: string[] = [];
  const networkFails: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (!r.ok() && r.url().includes('api')) networkFails.push(`${r.status()} ${r.url()}`); });

  await loginAdmin(page);
  await page.goto(`${BASE}/admin/salons`);
  await page.waitForTimeout(5000);

  const text = (await page.locator('body').textContent())?.replace(/\s+/g, ' ').trim().slice(0, 600);
  console.log(`\n=== SALONS PAGE BODY ===\n${text}`);
  if (errors.length) console.log('JS Errors:', errors);
  if (networkFails.length) console.log('Network Fails:', networkFails);
});

test('debug: super admin users page', async ({ page }) => {
  const errors: string[] = [];
  const networkFails: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (!r.ok() && r.url().includes('api')) networkFails.push(`${r.status()} ${r.url()}`); });

  await loginAdmin(page);
  await page.goto(`${BASE}/admin/users`);
  await page.waitForTimeout(5000);

  const text = (await page.locator('body').textContent())?.replace(/\s+/g, ' ').trim().slice(0, 600);
  console.log(`\n=== USERS PAGE BODY ===\n${text}`);
  if (errors.length) console.log('JS Errors:', errors);
  if (networkFails.length) console.log('Network Fails:', networkFails);
});
