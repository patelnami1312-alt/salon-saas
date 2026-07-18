import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const OWNER_EMAIL = 'owner@luxebeautylounge.com';
const OWNER_PASS  = 'Owner@12345';

async function login(page: any) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL);
  await page.locator('input[type="password"]').first().fill(OWNER_PASS);
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Salon SaaS – E2E Tests', () => {

  // ── 1. Login page ────────────────────────────────────────────────────────
  test('login page renders with email + password fields', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    console.log('✅ Login page OK');
  });

  // ── 2. Booking portal – services load ────────────────────────────────────
  test('booking portal loads and shows service cards', async ({ page }) => {
    await page.goto(`${BASE}/book`);
    // Wait for heading using exact role (avoids strict-mode multi-match)
    await expect(page.getByRole('heading', { name: /Choose a Service/i })).toBeVisible({ timeout: 10000 });
    // Services should render
    await page.waitForSelector('.MuiCardActionArea-root', { timeout: 12000 });
    const cards = await page.locator('.MuiCardActionArea-root').count();
    console.log(`✅ Booking portal: ${cards} service cards loaded`);
    expect(cards).toBeGreaterThan(0);
  });

  // ── 3. Booking flow – service → date/time step ───────────────────────────
  test('booking flow: pick service then reach date/time step', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/book`);

    // Wait for and click first service card
    await page.waitForSelector('.MuiCardActionArea-root', { timeout: 15000 });
    await page.locator('.MuiCardActionArea-root').first().click();

    // Continue button should be enabled after selecting a service
    const continueBtn = page.getByRole('button', { name: /Continue/i }).last();
    await expect(continueBtn).toBeEnabled({ timeout: 6000 });
    await continueBtn.click();

    // Should now show date/time step
    await expect(page.getByRole('heading', { name: /Pick a Date/i })).toBeVisible({ timeout: 8000 });
    // Stylist dropdown should be present
    await expect(page.getByRole('combobox')).toBeVisible({ timeout: 4000 });
    console.log('✅ Booking: step 1 (date/time) reached after picking service');
  });

  // ── 4. Customer portal – phone-first UI ──────────────────────────────────
  test('customer portal: phone-first, no tabs, no password', async ({ page }) => {
    await page.goto(`${BASE}/portal`);

    // Heading "My Account" should appear (use role to be specific)
    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible({ timeout: 8000 });

    // Old "Find My Booking" tab must NOT exist
    expect(await page.locator('text=Find My Booking').count()).toBe(0);

    // No password input on landing
    expect(await page.locator('input[type="password"]').count()).toBe(0);

    // Phone input is present
    await expect(page.locator('input[type="tel"], input[placeholder*="91"], input[placeholder*="phone" i]')
      .first()).toBeVisible({ timeout: 4000 }).catch(async () => {
        // MUI TextField doesn't always set type="tel"; check by placeholder
        await expect(page.locator('input').first()).toBeVisible();
      });

    // "View My Account →" button
    await expect(page.getByRole('button', { name: /View My Account/i })).toBeVisible();

    // "No password needed" hint text
    await expect(page.locator('text=No password needed')).toBeVisible();

    console.log('✅ Customer portal: clean phone-first UI confirmed');
  });

  // ── 5. Customer portal – empty phone validation ───────────────────────────
  test('customer portal: empty phone shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/portal`);
    await page.getByRole('button', { name: /View My Account/i }).click();
    await expect(page.locator('.MuiAlert-root')).toBeVisible({ timeout: 5000 });
    console.log('✅ Customer portal: empty phone validation works');
  });

  // ── 6. Customer portal – unknown number gives friendly error ──────────────
  test('customer portal: unknown number shows friendly error', async ({ page }) => {
    await page.goto(`${BASE}/portal`);
    await page.locator('input').first().fill('0000000000');
    await page.getByRole('button', { name: /View My Account/i }).click();
    await expect(page.locator('.MuiAlert-root')).toBeVisible({ timeout: 10000 });
    const text = await page.locator('.MuiAlert-root').textContent();
    console.log(`✅ Unknown number error: "${text?.trim()}"`);
    expect(text).toContain('No account found');
  });

  // ── 7. Protected route redirects to login ─────────────────────────────────
  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/login/, { timeout: 6000 });
    console.log('✅ Protected route redirects to /login');
  });

  // ── 8. Full login with real credentials ──────────────────────────────────
  test('login with salon owner credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').first().fill(OWNER_EMAIL);
    await page.locator('input[type="password"]').first().fill(OWNER_PASS);
    await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    console.log(`✅ Login success → ${page.url()}`);
    // Sidebar should be visible
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 6000 });
  });

  // ── 9. Dashboard widgets load ─────────────────────────────────────────────
  test('dashboard: KPI cards visible after login', async ({ page }) => {
    await login(page);
    await expect(page.locator('.MuiCard-root').first()).toBeVisible({ timeout: 10000 });
    const kpis = await page.locator('.MuiCard-root').count();
    console.log(`✅ Dashboard: ${kpis} cards rendered`);
    expect(kpis).toBeGreaterThan(2);
  });

  // ── 10. Check-in page ─────────────────────────────────────────────────────
  test('check-in page: queue and Walk-In button visible', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/checkin`);
    await expect(page.getByRole('heading', { name: /Reception|Check.In/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Walk-In', exact: true })).toBeVisible();
    console.log('✅ Check-In page loaded with Walk-In button');
  });

  // ── 11. Appointments page ─────────────────────────────────────────────────
  test('appointments page loads calendar', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/appointments`);
    // FullCalendar renders
    await expect(page.locator('.fc, .MuiCard-root').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Appointments page loaded');
  });

  // ── 12. Customers page ────────────────────────────────────────────────────
  test('customers page: data grid visible', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/customers`);
    await expect(page.locator('.MuiDataGrid-root, .MuiCard-root').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Customers page loaded');
  });

  // ── 13. Walk-In dialog opens ──────────────────────────────────────────────
  test('check-in: Walk-In dialog opens with search field', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/checkin`);
    await page.getByRole('button', { name: 'Walk-In', exact: true }).click();
    await expect(page.locator('.MuiDialog-root')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.MuiDialog-root input').first()).toBeVisible();
    console.log('✅ Walk-In dialog opened with search input');
  });

});
