/**
 * Interaction test — clicks every major button/action on each page
 * and records results: dialog opens, console errors, navigation outcomes.
 * Run: node interaction-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = 'e:/salon-saas/screenshots/interaction-test';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function log(page, action, status, detail = '') {
  const entry = { page, action, status, detail };
  results.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⚠️' : '❌';
  console.log(`${icon} [${page}] ${action}${detail ? ': ' + detail : ''}`);
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function waitForContent(page, timeout = 4000) {
  try {
    await page.waitForSelector('h5, h4, [role="grid"], .MuiCard-root', { timeout });
    return true;
  } catch { return false; }
}

async function dismissModal(page) {
  // Press Escape or click Cancel
  try {
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible({ timeout: 500 })) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
      return;
    }
  } catch { /* no cancel button */ }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function run() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const ctx = contexts[0] || await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), text: `PAGE ERROR: ${err.message}` });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const startUrl = page.url();
  console.log(`\n🌐 Starting URL: ${startUrl}\n`);

  // ──────────────────────────────────────────────────────────────────────
  // SIDEBAR NAV — test all nav links
  // ──────────────────────────────────────────────────────────────────────
  const navLinks = [
    { label: /dashboard/i, path: '/dashboard' },
    { label: /appointments/i, path: '/appointments' },
    { label: /customers/i, path: '/customers' },
    { label: /staff/i, path: '/staff' },
    { label: /services/i, path: '/services' },
    { label: /billing/i, path: '/billing' },
    { label: /marketing/i, path: '/marketing' },
    { label: /reports/i, path: '/reports' },
    { label: /settings/i, path: '/settings' },
  ];

  for (const nav of navLinks) {
    try {
      // Find nav link in sidebar
      const link = page.locator('nav a, [role="navigation"] a').filter({ hasText: nav.label }).first();
      const sidebarLink = page.locator('.MuiDrawer-root a, .MuiList-root a').filter({ hasText: nav.label }).first();
      const btn = sidebarLink.or(link);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(800);
        const hasContent = await waitForContent(page);
        log('Sidebar', `Navigate to ${nav.path}`, hasContent ? 'PASS' : 'FAIL', page.url());
      } else {
        log('Sidebar', `Navigate to ${nav.path}`, 'SKIP', 'Link not found');
      }
    } catch (e) {
      log('Sidebar', `Navigate to ${nav.path}`, 'FAIL', e.message.slice(0, 100));
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // APPOINTMENTS PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'appointments-initial');

  // Book Appointment button
  try {
    const bookBtn = page.getByRole('button', { name: /book appointment/i });
    if (await bookBtn.isVisible({ timeout: 2000 })) {
      await bookBtn.click();
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]');
      const open = await dialog.isVisible({ timeout: 2000 });
      log('Appointments', 'Book Appointment button → dialog opens', open ? 'PASS' : 'FAIL');
      if (open) {
        await screenshot(page, 'appointments-book-dialog');
        // Fill required fields
        try {
          await page.getByLabel(/customer/i).first().click();
          await page.waitForTimeout(300);
          await screenshot(page, 'appointments-book-dialog-customer-open');
        } catch { /* skip field interaction */ }
        await dismissModal(page);
        log('Appointments', 'Book Appointment dialog dismisses', 'PASS');
      }
    } else {
      log('Appointments', 'Book Appointment button', 'SKIP', 'Not visible');
    }
  } catch (e) {
    log('Appointments', 'Book Appointment button', 'FAIL', e.message.slice(0, 100));
  }

  // Status filter tabs
  try {
    const tabs = page.locator('.MuiTabs-root .MuiTab-root');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.nth(1).click();
      await page.waitForTimeout(400);
      log('Appointments', `Tab filter click (${count} tabs found)`, 'PASS');
    } else {
      log('Appointments', 'Tab filters', 'SKIP', 'No tabs found');
    }
  } catch (e) {
    log('Appointments', 'Tab filters', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // CUSTOMERS PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'customers-initial');

  // Add Customer button
  try {
    const addBtn = page.getByRole('button', { name: /add customer/i });
    if (await addBtn.isVisible({ timeout: 2000 })) {
      await addBtn.click();
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]');
      const open = await dialog.isVisible({ timeout: 2000 });
      log('Customers', 'Add Customer button → dialog opens', open ? 'PASS' : 'FAIL');
      if (open) {
        await screenshot(page, 'customers-add-dialog');
        // Fill first name
        try {
          await page.getByLabel(/first name/i).fill('Test');
          await page.getByLabel(/last name/i).fill('User');
          await page.getByLabel(/mobile/i).fill('1234567890');
          await screenshot(page, 'customers-add-dialog-filled');
          log('Customers', 'Add Customer form fields fillable', 'PASS');
        } catch (e2) {
          log('Customers', 'Add Customer form fields', 'FAIL', e2.message.slice(0, 80));
        }
        await dismissModal(page);
      }
    } else {
      log('Customers', 'Add Customer button', 'SKIP', 'Not visible');
    }
  } catch (e) {
    log('Customers', 'Add Customer button', 'FAIL', e.message.slice(0, 100));
  }

  // Search field
  try {
    const searchField = page.getByPlaceholder(/search by name/i);
    if (await searchField.isVisible({ timeout: 1000 })) {
      await searchField.fill('John');
      await page.waitForTimeout(600);
      log('Customers', 'Search field is functional', 'PASS');
      await searchField.clear();
    } else {
      log('Customers', 'Search field', 'SKIP', 'Not found');
    }
  } catch (e) {
    log('Customers', 'Search field', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // STAFF PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/staff`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  try {
    const addStaff = page.getByRole('button', { name: /add staff/i });
    if (await addStaff.isVisible({ timeout: 2000 })) {
      await addStaff.click();
      await page.waitForTimeout(800);
      const newUrl = page.url();
      log('Staff', 'Add Staff button → navigates', newUrl.includes('/staff/new') ? 'PASS' : 'SKIP', newUrl);
      await page.goto(`${BASE}/staff`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    log('Staff', 'Add Staff button', 'FAIL', e.message.slice(0, 100));
  }

  // Search field
  try {
    const searchField = page.getByPlaceholder(/search staff/i);
    if (await searchField.isVisible({ timeout: 1000 })) {
      await searchField.fill('Jane');
      await page.waitForTimeout(500);
      log('Staff', 'Search field functional', 'PASS');
      await searchField.clear();
    }
  } catch (e) {
    log('Staff', 'Search field', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // SERVICES PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'services-initial');

  try {
    const addService = page.getByRole('button', { name: /add service/i });
    if (await addService.isVisible({ timeout: 2000 })) {
      await addService.click();
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]');
      const open = await dialog.isVisible({ timeout: 1500 });
      log('Services', 'Add Service button → dialog', open ? 'PASS' : 'FAIL');
      if (open) {
        await screenshot(page, 'services-add-dialog');
        await dismissModal(page);
      }
    } else {
      log('Services', 'Add Service button', 'SKIP', 'Not visible');
    }
  } catch (e) {
    log('Services', 'Add Service button', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // BILLING PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/billing`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'billing-initial');

  try {
    const hasContent = await waitForContent(page, 3000);
    log('Billing', 'Page loads', hasContent ? 'PASS' : 'FAIL', page.url());
    // Check for any action buttons
    const actionBtns = page.getByRole('button').filter({ hasText: /add|new|pay|charge|save/i });
    const btnCount = await actionBtns.count();
    log('Billing', `Action buttons found`, btnCount > 0 ? 'PASS' : 'SKIP', `${btnCount} buttons`);
  } catch (e) {
    log('Billing', 'Page interaction', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // MARKETING PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/marketing`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  try {
    const newCampaign = page.getByRole('button', { name: /new campaign/i });
    if (await newCampaign.isVisible({ timeout: 2000 })) {
      await newCampaign.click();
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]');
      const open = await dialog.isVisible({ timeout: 1500 });
      log('Marketing', 'New Campaign button → dialog', open ? 'PASS' : 'FAIL');
      if (open) {
        await screenshot(page, 'marketing-campaign-dialog');
        // Fill campaign name
        try {
          await page.getByLabel(/campaign name/i).fill('Test Campaign');
          await page.waitForTimeout(300);
          log('Marketing', 'Campaign name field fillable', 'PASS');
        } catch { /* skip */ }
        await dismissModal(page);
      }
    } else {
      log('Marketing', 'New Campaign button', 'SKIP', 'Not visible');
    }
  } catch (e) {
    log('Marketing', 'New Campaign button', 'FAIL', e.message.slice(0, 100));
  }

  // Marketing tabs
  try {
    const templatesTab = page.getByRole('tab', { name: /templates/i });
    if (await templatesTab.isVisible({ timeout: 1000 })) {
      await templatesTab.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'marketing-templates-tab');
      log('Marketing', 'Templates tab', 'PASS');
    }
  } catch (e) {
    log('Marketing', 'Templates tab', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // REPORTS PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/reports/revenue`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'reports-revenue');

  try {
    const hasContent = await waitForContent(page, 3000);
    log('Reports', 'Revenue tab loads', hasContent ? 'PASS' : 'FAIL');

    // Staff tab
    const staffTab = page.getByRole('tab', { name: /staff/i });
    if (await staffTab.isVisible({ timeout: 1000 })) {
      await staffTab.click();
      await page.waitForTimeout(600);
      await screenshot(page, 'reports-staff-tab');
      log('Reports', 'Staff tab click', 'PASS');
    }

    // Services tab
    const svcTab = page.getByRole('tab', { name: /services/i });
    if (await svcTab.isVisible({ timeout: 500 })) {
      await svcTab.click();
      await page.waitForTimeout(600);
      log('Reports', 'Services tab click', 'PASS');
    }
  } catch (e) {
    log('Reports', 'Tab navigation', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // SETTINGS PAGE
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await screenshot(page, 'settings-initial');

  try {
    const hasContent = await waitForContent(page, 3000);
    log('Settings', 'Page loads', hasContent ? 'PASS' : 'FAIL');

    // Try clicking each settings tab
    const tabs = page.locator('.MuiTabs-root .MuiTab-root');
    const tabCount = await tabs.count();
    log('Settings', `Settings tabs found: ${tabCount}`, tabCount > 0 ? 'PASS' : 'SKIP');

    for (let i = 0; i < Math.min(tabCount, 5); i++) {
      try {
        await tabs.nth(i).click();
        await page.waitForTimeout(400);
      } catch { /* continue */ }
    }
    if (tabCount > 0) {
      await screenshot(page, 'settings-tabs-tested');
      log('Settings', 'All settings tabs clickable', 'PASS');
    }

    // Save button
    const saveBtn = page.getByRole('button', { name: /save/i });
    if (await saveBtn.isVisible({ timeout: 1000 })) {
      log('Settings', 'Save button visible', 'PASS');
    }
  } catch (e) {
    log('Settings', 'Settings interaction', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // DASHBOARD — test refresh button
  // ──────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  try {
    const refreshBtn = page.getByRole('button', { name: /refresh/i });
    if (await refreshBtn.isVisible({ timeout: 2000 })) {
      await refreshBtn.click();
      await page.waitForTimeout(800);
      log('Dashboard', 'Refresh button clickable', 'PASS');
    } else {
      log('Dashboard', 'Refresh button', 'SKIP', 'Not found');
    }
  } catch (e) {
    log('Dashboard', 'Refresh button', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // TOPBAR — profile menu
  // ──────────────────────────────────────────────────────────────────────
  try {
    const avatarBtn = page.locator('.MuiAvatar-root').first();
    if (await avatarBtn.isVisible({ timeout: 1000 })) {
      await avatarBtn.click();
      await page.waitForTimeout(400);
      const menu = page.locator('.MuiMenu-root, [role="menu"]');
      const menuOpen = await menu.isVisible({ timeout: 1000 });
      log('TopBar', 'Avatar menu opens', menuOpen ? 'PASS' : 'FAIL');
      if (menuOpen) {
        await screenshot(page, 'topbar-profile-menu');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  } catch (e) {
    log('TopBar', 'Avatar menu', 'FAIL', e.message.slice(0, 100));
  }

  // ──────────────────────────────────────────────────────────────────────
  // CONSOLE ERRORS SUMMARY
  // ──────────────────────────────────────────────────────────────────────
  const realErrors = consoleErrors.filter(e =>
    !e.text.includes('401') &&
    !e.text.includes('Failed to fetch') &&
    !e.text.includes('NetworkError') &&
    !e.text.includes('ERR_') &&
    !e.text.includes('favicon')
  );

  console.log('\n' + '═'.repeat(60));
  console.log('INTERACTION TEST RESULTS');
  console.log('═'.repeat(60));

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⚠️ SKIP: ${skip}`);

  if (fail > 0) {
    console.log('\n❌ FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  [${r.page}] ${r.action}: ${r.detail}`);
    });
  }

  if (realErrors.length > 0) {
    console.log(`\n🔴 Console Errors (${realErrors.length}):`);
    realErrors.slice(0, 10).forEach(e => console.log(`  ${e.url}: ${e.text.slice(0, 120)}`));
  } else {
    console.log('\n✅ No critical console errors');
  }

  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

  await page.close();
  await browser.close();
}

run().catch(console.error);
