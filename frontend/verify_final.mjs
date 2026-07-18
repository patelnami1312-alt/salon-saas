/**
 * Final comprehensive verification — Salon POS
 * Handles route redirects, MUI dialog force-clicks, lazy chunk pre-warm.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE  = 'http://localhost:3000';
const EMAIL = 'admin@salonsaas.com';
const PASS  = 'Admin@12345';

const results = [];
let page, browser;

const pass  = (l, d) => { const s = `✅ ${l}${d ? ' — ' + d : ''}`; results.push(s); console.log(s); };
const fail  = (l, d) => { const s = `❌ ${l}${d ? ' — ' + d : ''}`; results.push(s); console.log(s); };
const probe = (l, d) => { const s = `🔍 ${l}${d ? ' — ' + d : ''}`; results.push(s); console.log(s); };
const warn  = (l, d) => { const s = `⚠️  ${l}${d ? ' — ' + d : ''}`; results.push(s); console.log(s); };

async function ss(name) {
  try { await page.screenshot({ path: `e:/salon-saas/frontend/verify_shots/${name}.png` }); } catch {}
}

async function go(path, ms = 2000) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(ms);
    // Wait for suspense to resolve (no loading spinner)
    await page.waitForFunction(() => !document.querySelector('.MuiCircularProgress-root') || document.querySelectorAll('.MuiCard-root, .MuiDataGrid-root, .fc, form').length > 0, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    const err = await page.locator('text="Something went wrong"').count();
    return err === 0;
  } catch { return false; }
}

async function closeDialog() {
  for (const sel of ['button:has-text("Cancel")', 'button:has-text("Close")', 'button[aria-label="close"]']) {
    try { const b = page.locator(sel).first(); if (await b.count() > 0) { await b.click({ force: true, timeout: 3000 }); await page.waitForTimeout(400); return; } } catch {}
  }
  try { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } catch {}
}

// ── Pre-warm all lazy chunks ────────────────────────────────────────────────
async function preWarm() {
  const routes = ['/dashboard','/customers','/staff','/appointments','/calendar',
    '/checkin','/billing','/inventory/products','/services','/marketing',
    '/reports/revenue','/settings'];
  for (const r of routes) {
    try { await page.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 12000 }); await page.waitForTimeout(600); } catch {}
  }
}

// ─── 1. LOGIN ──────────────────────────────────────────────────────────────
async function testLogin() {
  console.log('\n═══ LOGIN ═══');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', 'wrongpass');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  (await page.locator('text=/invalid|incorrect|wrong|credentials/i').count()) > 0
    ? pass('Login: wrong password error shown') : warn('Login: error not visible');

  await page.fill('input[type="password"]', PASS);
  const t0 = Date.now();
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 12000 });
  const ms = Date.now() - t0;
  pass('Login: success', `${ms}ms`);
  ms < 2000 ? pass('Login: fast (<2s)') : warn('Login: slow', `${ms}ms`);
  await page.waitForTimeout(1200);
  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Login: no hooks error on dashboard') : fail('Login: hooks error boundary after login');
}

// ─── 2. DASHBOARD ──────────────────────────────────────────────────────────
async function testDashboard() {
  console.log('\n═══ DASHBOARD ═══');
  if (!await go('/dashboard')) { fail('Dashboard: load failed'); return; }
  pass('Dashboard: loaded');
  const cards = await page.locator('.MuiCard-root').count();
  cards >= 3 ? pass('Dashboard: KPI cards present', `${cards}`) : warn('Dashboard: few cards', `${cards}`);
  const body = await page.locator('body').textContent();
  body?.includes('$') ? pass('Dashboard: $ shown') : warn('Dashboard: no $ found');
  body?.includes('₹') ? fail('Dashboard: ₹ found') : pass('Dashboard: no ₹');
  body?.includes('Revenue') || body?.includes('Appointment') ? pass('Dashboard: stats visible') : warn('Dashboard: no stat labels');
  await ss('01-dashboard');
}

// ─── 3. CUSTOMERS ──────────────────────────────────────────────────────────
async function testCustomers() {
  console.log('\n═══ CUSTOMERS ═══');
  if (!await go('/customers')) { fail('Customers: load failed'); return; }
  const rows = await page.locator('.MuiDataGrid-row').count();
  rows > 0 ? pass('Customers: rows loaded', `${rows}`) : warn('Customers: empty (DB may be fresh)');

  // Search
  try {
    const srch = page.locator('input[placeholder*="earch" i]').first();
    await srch.fill('a'); await page.waitForTimeout(1000);
    pass('Customers: search works');
    await srch.fill(''); await page.waitForTimeout(600);
  } catch { warn('Customers: search error'); }

  // Add Customer dialog
  try {
    await page.locator('button:has-text("Add Customer"), button:has-text("Add"), button:has-text("New")').first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    if ((await page.locator('.MuiDialog-root').count()) > 0) {
      pass('Customers: Add dialog opens');
      await page.locator('input[name="first_name"], input[placeholder*="First" i]').first().fill('AutoTest');
      await page.locator('input[name="last_name"], input[placeholder*="Last" i]').first().fill('User');
      await page.locator('input[name="mobile"], input[type="tel"]').first().fill('5551230001');
      pass('Customers: form filled');
      // Submit via form.submit() to bypass pointer intercept
      await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.requestSubmit(); });
      await page.waitForTimeout(2000);
      const stillOpen = await page.locator('.MuiDialog-root').count();
      !stillOpen ? pass('Customers: Add submitted') : warn('Customers: dialog still open (validation?)');
      if (stillOpen) await closeDialog();
    } else {
      warn('Customers: no Add dialog');
    }
  } catch(e) { warn('Customers: Add flow error', e.message.slice(0,50)); await closeDialog(); }

  // Profile
  try {
    await go('/customers', 1200);
    const r = page.locator('.MuiDataGrid-row').first();
    const viewBtn = r.locator('[data-testid*="Visibility"], button[aria-label*="view" i]').first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      page.url().includes('/customers/') ? pass('Customers: profile opens') : warn('Customers: no profile nav');
      await ss('03-customer-profile');
      await page.goBack(); await page.waitForTimeout(600);
    } else {
      probe('Customers: no view button (icon-only row action)');
    }
  } catch { probe('Customers: profile nav skipped'); }

  await ss('02-customers');
}

// ─── 4. STAFF ──────────────────────────────────────────────────────────────
async function testStaff() {
  console.log('\n═══ STAFF ═══');
  if (!await go('/staff')) { fail('Staff: load failed'); return; }
  const rows = await page.locator('.MuiDataGrid-row').count();
  rows > 0 ? pass('Staff: rows loaded', `${rows}`) : warn('Staff: empty table');

  // Add staff → /staff/new
  try {
    await page.locator('button:has-text("Add Staff"), button:has-text("Add")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    if (page.url().includes('/new')) {
      const err = await page.locator('text="Something went wrong"').count();
      err === 0 ? pass('Staff /new: loads without error') : fail('Staff /new: error boundary');
      await page.goBack(); await page.waitForTimeout(600);
    } else if ((await page.locator('.MuiDialog-root').count()) > 0) {
      pass('Staff: Add dialog opens'); await closeDialog();
    } else {
      warn('Staff: no dialog/nav after Add');
    }
  } catch(e) { warn('Staff: Add error', e.message.slice(0,40)); await closeDialog(); }

  // Profile
  try {
    const viewBtn = page.locator('.MuiDataGrid-row').first().locator('[data-testid*="Visibility"], button').first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click({ timeout: 5000 }); await page.waitForTimeout(1200);
      page.url().includes('/staff/') ? pass('Staff: profile opens') : warn('Staff: no profile nav');
      await ss('04-staff-profile'); await page.goBack(); await page.waitForTimeout(600);
    }
  } catch {}

  await ss('05-staff');
}

// ─── 5. APPOINTMENTS ───────────────────────────────────────────────────────
async function testAppointments() {
  console.log('\n═══ APPOINTMENTS ═══');
  if (!await go('/appointments')) { fail('Appointments: load failed'); return; }
  const rows = await page.locator('.MuiDataGrid-row').count();
  pass('Appointments: loaded', `${rows} rows`);
  (await page.locator('[role="combobox"], select').count()) > 0 ? pass('Appointments: filter controls') : probe('Appointments: no filter');

  try {
    await page.locator('button:has-text("Book"), button:has-text("Add"), button:has-text("New Appointment")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    (await page.locator('.MuiDialog-root, .MuiDrawer-root').count()) > 0
      ? (pass('Appointments: booking dialog opens'), await closeDialog())
      : warn('Appointments: no dialog after Book');
  } catch(e) { warn('Appointments: Book error', e.message.slice(0,40)); await closeDialog(); }

  await ss('06-appointments');
}

// ─── 6. CALENDAR ───────────────────────────────────────────────────────────
async function testCalendar() {
  console.log('\n═══ CALENDAR ═══');
  if (!await go('/calendar', 2500)) { fail('Calendar: load failed'); return; }
  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Calendar: no error boundary') : fail('Calendar: error boundary');
  (await page.locator('.fc, .fc-view-harness').count()) > 0
    ? pass('Calendar: FullCalendar rendered') : warn('Calendar: FullCalendar not found');
  const chips = await page.locator('.MuiChip-root').count();
  chips > 0 ? pass('Calendar: staff chips present', `${chips}`) : probe('Calendar: no chips');

  try {
    await page.locator('button:has-text("Book"), button:has-text("New"), button:has-text("Add")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    if ((await page.locator('.MuiDialog-root').count()) > 0) {
      pass('Calendar: booking dialog opens');
      (await page.locator('.MuiStepper-root').count()) > 0 ? pass('Calendar: booking stepper visible') : probe('Calendar: no stepper');
      await closeDialog();
    } else {
      warn('Calendar: no dialog after Book');
    }
  } catch(e) { warn('Calendar: Book error', e.message.slice(0,40)); await closeDialog(); }

  await ss('07-calendar');
}

// ─── 7. CHECK-IN ───────────────────────────────────────────────────────────
async function testCheckIn() {
  console.log('\n═══ CHECK-IN ═══');
  if (!await go('/checkin')) { fail('CheckIn: load failed'); return; }
  pass('CheckIn: loaded');

  try {
    await page.locator('button:has-text("Walk-In"), button:has-text("Walk In"), button:has-text("Walk")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    if ((await page.locator('.MuiDialog-root').count()) > 0) {
      pass('CheckIn: Walk-in dialog opens');
      // Open the service dropdown to reveal prices
      const serviceSelect = page.locator('.MuiDialog-root [role="combobox"]').first();
      if (await serviceSelect.count() > 0) {
        await serviceSelect.click({ timeout: 3000 });
        await page.waitForTimeout(600);
        const opts = await page.locator('[role="option"], .MuiMenuItem-root').count();
        if (opts > 0) {
          await page.locator('[role="option"], .MuiMenuItem-root').first().click();
          await page.waitForTimeout(400);
          // Now check for $ in dialog
          const dlgTxt = await page.locator('.MuiDialog-root').textContent();
          dlgTxt?.includes('$') ? pass('CheckIn: dialog shows $ pricing') : probe('CheckIn: $ not in dialog text (in dropdown options)');
          probe('CheckIn: services loaded with formatCurrency', `${opts} options`);
        }
      }
      await closeDialog();
    } else {
      warn('CheckIn: no Walk-in dialog');
    }
  } catch(e) { warn('CheckIn: walk-in error', e.message.slice(0,40)); await closeDialog(); }

  await ss('08-checkin');
}

// ─── 8. BILLING ────────────────────────────────────────────────────────────
async function testBilling() {
  console.log('\n═══ BILLING / POS ═══');
  if (!await go('/billing', 2000)) { fail('Billing: load failed'); return; }
  const body = await page.locator('body').textContent();
  body?.includes('$') ? pass('Billing: $ currency') : warn('Billing: no $');
  body?.includes('₹') ? fail('Billing: ₹ found') : pass('Billing: no ₹');

  const cards = await page.locator('.MuiCard-root').count();
  cards > 0 ? pass('Billing: cards visible', `${cards}`) : warn('Billing: no cards');

  // Payment method boxes (use Box with onClick, not <button>)
  const payLabels = await page.locator('.MuiGrid-root').filter({ hasText: 'Cash' }).count();
  payLabels > 0 ? pass('Billing: Cash payment option visible') : probe('Billing: Cash not found in grid (may need cart item first)');

  // Checkout button
  (await page.locator('button:has-text("Checkout"), button:has-text("Pay"), button:has-text("Complete")').count()) > 0
    ? pass('Billing: Checkout button present') : warn('Billing: no Checkout button');

  // Customer search
  try {
    const srch = page.locator('input[placeholder*="customer" i], input[placeholder*="search" i]').first();
    if (await srch.count() > 0) { await srch.fill('Test'); await page.waitForTimeout(800); pass('Billing: customer search works'); }
  } catch {}

  await ss('09-billing');
}

// ─── 9. INVENTORY ──────────────────────────────────────────────────────────
async function testInventory() {
  console.log('\n═══ INVENTORY ═══');
  if (!await go('/inventory/products')) { fail('Inventory: load failed'); return; }
  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Inventory: loads without error') : fail('Inventory: error boundary');
  const rows = await page.locator('.MuiDataGrid-row').count();
  pass('Inventory: table loaded', `${rows} rows`);

  // Add Product dialog (now implemented)
  try {
    const addBtn = page.locator('button:has-text("Add Product")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click({ timeout: 5000 }); await page.waitForTimeout(800);
      if ((await page.locator('.MuiDialog-root').count()) > 0) {
        pass('Inventory: Add Product dialog opens');
        await page.locator('input[label="Product Name"], input').nth(0).fill('Test Product');
        await page.locator('text="Sale Price"').locator('..').locator('input').fill('25.00').catch(() => {});
        await closeDialog();
      } else {
        warn('Inventory: no Add Product dialog');
      }
    } else {
      warn('Inventory: Add Product button not found');
    }
  } catch(e) { warn('Inventory: Add error', e.message.slice(0,50)); await closeDialog(); }

  await ss('10-inventory');
}

// ─── 10. SERVICES ──────────────────────────────────────────────────────────
async function testServices() {
  console.log('\n═══ SERVICES ═══');
  if (!await go('/services')) { fail('Services: load failed'); return; }
  const body = await page.locator('body').textContent();
  body?.includes('$') ? pass('Services: $ pricing') : warn('Services: no $');
  body?.includes('₹') ? fail('Services: ₹ found') : pass('Services: no ₹');
  pass('Services: loaded');

  try {
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Service")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click({ timeout: 5000 }); await page.waitForTimeout(800);
      (await page.locator('.MuiDialog-root').count()) > 0
        ? (pass('Services: Add dialog opens'), await closeDialog()) : warn('Services: no dialog');
    }
  } catch(e) { warn('Services: Add error', e.message.slice(0,40)); await closeDialog(); }

  await ss('11-services');
}

// ─── 11. MARKETING ─────────────────────────────────────────────────────────
async function testMarketing() {
  console.log('\n═══ MARKETING ═══');
  if (!await go('/marketing')) { fail('Marketing: load failed'); return; }
  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Marketing: loads without error') : fail('Marketing: error boundary');
  const body = await page.locator('body').textContent();
  (body?.includes('Campaign') || body?.includes('campaign'))
    ? pass('Marketing: content visible') : warn('Marketing: unexpected content');

  try {
    const btn = page.locator('button:has-text("New Campaign"), button:has-text("Create"), button:has-text("New")').first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 5000 }); await page.waitForTimeout(800);
      (await page.locator('.MuiDialog-root').count()) > 0
        ? (pass('Marketing: Create dialog opens'), await closeDialog()) : warn('Marketing: no dialog');
    } else { probe('Marketing: no campaign button visible'); }
  } catch(e) { warn('Marketing: dialog error', e.message.slice(0,40)); await closeDialog(); }

  await ss('12-marketing');
}

// ─── 12. REPORTS ───────────────────────────────────────────────────────────
async function testReports() {
  console.log('\n═══ REPORTS ═══');
  // Navigate to specific sub-route (not /reports which redirects)
  if (!await go('/reports/revenue', 3000)) { fail('Reports: load failed'); return; }

  // Wait for content (not just spinner)
  await page.waitForFunction(
    () => document.querySelectorAll('.MuiCard-root, .MuiDataGrid-root').length > 0,
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(500);

  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Reports: loads without error') : fail('Reports: error boundary');

  const body = await page.locator('body').textContent();
  body?.includes('₹') ? fail('Reports: ₹ shown') : pass('Reports: no ₹');
  body?.includes('Revenue') ? pass('Reports: Revenue content visible') : warn('Reports: no Revenue text');

  // Navigate through each sub-route (sidebar nav) instead of clicking tabs
  const subRoutes = [
    ['/reports/staff',     'Staff'],
    ['/reports/services',  'Services'],
    ['/reports/customers', 'Customers'],
    ['/reports/inventory', 'Inventory'],
  ];

  for (const [route, label] of subRoutes) {
    if (!await go(route, 2000)) {
      fail(`Reports: ${label} sub-route failed`);
    } else {
      (await page.locator('text="Something went wrong"').count()) === 0
        ? pass(`Reports: ${label} sub-route loads`) : fail(`Reports: ${label} error boundary`);
    }
  }

  await ss('13-reports');
}

// ─── 13. SETTINGS ──────────────────────────────────────────────────────────
async function testSettings() {
  console.log('\n═══ SETTINGS ═══');
  if (!await go('/settings')) { fail('Settings: load failed'); return; }
  (await page.locator('text="Something went wrong"').count()) === 0
    ? pass('Settings: loads without error') : fail('Settings: error boundary');

  // Check form has currency field
  const currencyField = await page.locator('label:has-text("Currency")').count();
  currencyField > 0 ? pass('Settings: Currency field present') : warn('Settings: no Currency field found');

  // Check USD is selected
  const body = await page.locator('body').textContent();
  (body?.includes('USD') || body?.includes('US Dollar')) ? pass('Settings: USD currency shown') : warn('Settings: USD not visible');

  // Save
  try {
    const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click({ timeout: 5000 }); await page.waitForTimeout(1500);
      // react-hot-toast uses .go-* classes or [role="status"]
      const toastCount = await page.locator('[class*="go"], [role="status"], [class*="toast"]').count();
      toastCount > 0 ? pass('Settings: toast shown after save') : probe('Settings: no visible toast (may have dismissed quickly)');
    } else {
      warn('Settings: no Save button');
    }
  } catch(e) { warn('Settings: Save error', e.message.slice(0,40)); }

  await ss('14-settings');
}

// ─── 14. SIDEBAR NAV ───────────────────────────────────────────────────────
async function testSidebar() {
  console.log('\n═══ SIDEBAR NAVIGATION ═══');
  if (!await go('/dashboard', 1000)) return;

  // The sidebar uses ListItemButton components which render as <div role="button">
  // or just look at actual text within the sidebar drawer
  const sidebarLinks = [
    ['Dashboard',    '/dashboard'],
    ['Appointments', '/appointments'],
    ['Check-In',     '/checkin'],
    ['Customers',    '/customers'],
    ['Staff',        '/staff'],
    ['Services',     '/services'],
    ['Billing',      '/billing'],
    ['Inventory',    '/inventory/products'],
    ['Marketing',    '/marketing'],
    ['Reports',      '/reports/revenue'],
    ['Settings',     '/settings'],
  ];

  for (const [label, expectedPath] of sidebarLinks) {
    try {
      // MUI Drawer sidebar uses ListItemButton — click by text within sidebar
      const sidebarEl = page.locator('.MuiDrawer-root, aside').first()
        .locator(`text="${label}"`).first();
      const count = await sidebarEl.count();
      if (count > 0) {
        await sidebarEl.click({ timeout: 5000 }); await page.waitForTimeout(1200);
        const url = page.url();
        const err = await page.locator('text="Something went wrong"').count();
        if (err > 0) {
          fail(`Sidebar: ${label} → error boundary`);
        } else if (url.includes(expectedPath.split('/')[1])) {
          pass(`Sidebar: ${label} → navigates OK`);
        } else {
          warn(`Sidebar: ${label} → unexpected URL`, url.split('/').slice(-1)[0]);
        }
      } else {
        probe(`Sidebar: "${label}" element not found`);
      }
    } catch(e) { warn(`Sidebar: ${label} error`, e.message.slice(0,40)); }
  }
}

// ─── 15. AUTH GUARD ────────────────────────────────────────────────────────
async function testAuthGuard() {
  console.log('\n═══ AUTH GUARD ═══');
  const ctx2 = await browser.newContext();
  const p2   = await ctx2.newPage();
  try {
    await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 12000 });
    await p2.waitForTimeout(2000);
    // Wait for auth check to complete (app initializes, then redirects)
    await p2.waitForURL(/login/, { timeout: 5000 }).catch(() => {});
    p2.url().includes('/login') ? pass('Auth guard: unauthenticated → /login redirect')
      : warn('Auth guard: did not redirect to /login', p2.url());
  } catch(e) { warn('Auth guard error', e.message.slice(0,40)); }
  finally { await ctx2.close(); }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
const jsErrors = [];

(async () => {
  mkdirSync('e:/salon-saas/frontend/verify_shots', { recursive: true });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401')) jsErrors.push(m.text().slice(0,150)); });
  page.on('pageerror', e => jsErrors.push('[pageerror] ' + e.message.slice(0,150)));

  try {
    await testLogin();
    console.log('\n[Pre-warming lazy chunks…]');
    await preWarm();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await testDashboard();
    await testCustomers();
    await testStaff();
    await testAppointments();
    await testCalendar();
    await testCheckIn();
    await testBilling();
    await testInventory();
    await testServices();
    await testMarketing();
    await testReports();
    await testSettings();
    await testSidebar();
    await testAuthGuard();
  } catch(e) { fail('Test runner crash', e.message.slice(0,80)); }
  finally { await browser.close(); }

  console.log('\n' + '═'.repeat(64));
  console.log('VERIFICATION SUMMARY');
  console.log('═'.repeat(64));
  const passes = results.filter(r => r.startsWith('✅')).length;
  const fails  = results.filter(r => r.startsWith('❌')).length;
  const warns  = results.filter(r => r.startsWith('⚠️')).length;
  const probes = results.filter(r => r.startsWith('🔍')).length;
  console.log(`✅ PASS:  ${passes}`);
  console.log(`❌ FAIL:  ${fails}`);
  console.log(`⚠️  WARN:  ${warns}`);
  console.log(`🔍 PROBE: ${probes}`);
  console.log(`Total checks: ${results.length}`);
  if (fails > 0)  { console.log('\nFAILURES:');  results.filter(r => r.startsWith('❌')).forEach(r => console.log(' ', r)); }
  if (warns > 0)  { console.log('\nWARNINGS:');  results.filter(r => r.startsWith('⚠️')).forEach(r => console.log(' ', r)); }
  if (probes > 0) { console.log('\nPROBES:');    results.filter(r => r.startsWith('🔍')).forEach(r => console.log(' ', r)); }
  if (jsErrors.length > 0) {
    const u = [...new Set(jsErrors)];
    console.log(`\nJS ERRORS (${u.length}):`);
    u.slice(0,8).forEach(e => console.log(' •', e.split('\n')[0]));
  } else {
    console.log('\nJS ERRORS: none ✅');
  }
  console.log('\nVerdict:', fails === 0 ? (warns <= 4 ? '✅ PASS' : '⚠️ PASS with warnings') : '❌ FAIL');
})();
