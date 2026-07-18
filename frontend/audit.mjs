/**
 * Full end-to-end browser audit via CDP on port 9222.
 * Tests every page, tab, button, dialog, and form interaction.
 * Captures console errors and screenshots for each page.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const SHOTS = 'e:/salon-saas/screenshots/audit';

fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const log = [];

function note(msg) { console.log(msg); log.push(msg); }

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0] || await browser.newContext();
const page = ctx.pages()[0] || await ctx.newPage();

// Collect console errors
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ url: page.url(), text: msg.text() });
  }
});
page.on('pageerror', err => {
  consoleErrors.push({ url: page.url(), text: err.message });
});

await page.setViewportSize({ width: 1440, height: 900 });

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function waitReady() {
  await page.waitForTimeout(1200);
}

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await waitReady();
}

// ─── Helper: check for visible error messages ─────────────────────────────
async function checkErrors(context) {
  const errorTexts = await page.$$eval('[role="alert"], .MuiAlert-root', els =>
    els.map(el => el.textContent?.trim()).filter(Boolean)
  );
  if (errorTexts.length) {
    errors.push({ context, alerts: errorTexts });
    note(`  ⚠ Alert on ${context}: ${errorTexts.join(' | ')}`);
  }
}

// ─── 0. LOGIN ──────────────────────────────────────────────────────────────
note('\n=== LOGIN PAGE ===');
await goto('/login');
await shot('00-login');

// Check login form fields exist
const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
const passInput = page.locator('input[type="password"]').first();
const loginBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();

const hasEmail = await emailInput.isVisible().catch(() => false);
const hasPass = await passInput.isVisible().catch(() => false);
const hasBtn = await loginBtn.isVisible().catch(() => false);
note(`  Login form: email=${hasEmail}, password=${hasPass}, submit=${hasBtn}`);

if (hasEmail && hasPass && hasBtn) {
  await emailInput.fill('admin@salon.com');
  await passInput.fill('admin123');
  await shot('00-login-filled');
  await loginBtn.click();
  await waitReady();
  await page.waitForTimeout(1500);
  note(`  After login → URL: ${page.url()}`);
  await shot('00-after-login');
}

const currentUrl = page.url();
if (currentUrl.includes('/login')) {
  note('  Still on login — trying alternate credentials');
  await emailInput.fill('test@test.com');
  await passInput.fill('password123');
  await loginBtn.click();
  await waitReady();
}

// ─── 1. DASHBOARD ─────────────────────────────────────────────────────────
note('\n=== DASHBOARD ===');
await goto('/dashboard');
await shot('01-dashboard');
await checkErrors('dashboard');

// Check stat cards
const statCards = await page.$$('.MuiCard-root');
note(`  Stat cards found: ${statCards.length}`);

// Check charts are rendered (MUI X charts create SVG elements)
const svgs = await page.$$('svg');
note(`  SVG chart elements: ${svgs.length}`);

// Check Refresh button
const refreshBtn = page.locator('button:has-text("Refresh")');
if (await refreshBtn.isVisible()) {
  await refreshBtn.click();
  await page.waitForTimeout(800);
  note('  Refresh button: clicked ✓');
}

// ─── 2. APPOINTMENTS ──────────────────────────────────────────────────────
note('\n=== APPOINTMENTS ===');
await goto('/appointments');
await shot('02-appointments');
await checkErrors('appointments');

// Check DataGrid renders
const datagrid = page.locator('.MuiDataGrid-root').first();
const hasGrid = await datagrid.isVisible().catch(() => false);
note(`  DataGrid visible: ${hasGrid}`);

// Status filter
const statusSelect = page.locator('label:has-text("Status")').first();
if (await statusSelect.isVisible()) {
  note('  Status filter: visible ✓');
}

// Book Appointment button
const bookBtn = page.locator('button:has-text("Book Appointment")');
if (await bookBtn.isVisible()) {
  await bookBtn.click();
  await waitReady();
  await shot('02-book-dialog');
  note('  Book dialog: opened ✓');

  // Check DatePicker is present
  const datePicker = page.locator('[placeholder*="date" i], input[type="text"]').first();
  note(`  DatePicker field: ${await datePicker.isVisible().catch(() => false)}`);

  // Close dialog
  const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")');
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await waitReady();
    note('  Book dialog: closed ✓');
  }
}

// Calendar view button
const calBtn = page.locator('button:has-text("Calendar View"), a:has-text("Calendar View")').first();
note(`  Calendar View button: ${await calBtn.isVisible().catch(() => false)}`);

// ─── 3. CUSTOMERS ─────────────────────────────────────────────────────────
note('\n=== CUSTOMERS ===');
await goto('/customers');
await shot('03-customers');
await checkErrors('customers');

const custGrid = page.locator('.MuiDataGrid-root').first();
note(`  DataGrid visible: ${await custGrid.isVisible().catch(() => false)}`);

// Search
const searchInput = page.locator('input[placeholder*="search" i]').first();
if (await searchInput.isVisible()) {
  await searchInput.fill('test');
  await page.waitForTimeout(800);
  await shot('03-customers-search');
  await searchInput.clear();
  note('  Search: typed and cleared ✓');
}

// Add Customer dialog
const addBtn = page.locator('button:has-text("Add Customer")');
if (await addBtn.isVisible()) {
  await addBtn.click();
  await waitReady();
  await shot('03-add-customer-dialog');
  note('  Add Customer dialog: opened ✓');

  // Fill form
  const firstName = page.locator('input[id*="first_name"], input[placeholder*="First Name" i], label:has-text("First Name") ~ div input').first();
  const lastName = page.locator('input[id*="last_name"], input[placeholder*="Last Name" i], label:has-text("Last Name") ~ div input').first();
  const mobile = page.locator('input[id*="mobile"], label:has-text("Mobile") ~ div input').first();

  note(`  First name input: ${await firstName.isVisible().catch(() => false)}`);
  note(`  Last name input: ${await lastName.isVisible().catch(() => false)}`);
  note(`  Mobile input: ${await mobile.isVisible().catch(() => false)}`);

  const dialogCancel = page.locator('[role="dialog"] button:has-text("Cancel")');
  if (await dialogCancel.isVisible()) {
    await dialogCancel.click();
    await waitReady();
    note('  Add dialog: closed ✓');
  }
}

// ─── 4. STAFF ─────────────────────────────────────────────────────────────
note('\n=== STAFF ===');
await goto('/staff');
await shot('04-staff');
await checkErrors('staff');

const staffGrid = page.locator('.MuiDataGrid-root').first();
note(`  DataGrid visible: ${await staffGrid.isVisible().catch(() => false)}`);

const addStaffBtn = page.locator('button:has-text("Add Staff")');
note(`  Add Staff button: ${await addStaffBtn.isVisible().catch(() => false)}`);

// ─── 5. SERVICES ──────────────────────────────────────────────────────────
note('\n=== SERVICES ===');
await goto('/services');
await shot('05-services');
await checkErrors('services');

// ─── 6. INVENTORY ─────────────────────────────────────────────────────────
note('\n=== INVENTORY ===');
await goto('/inventory');
await shot('06-inventory-products');
await checkErrors('inventory-products');

const invGrid = page.locator('.MuiDataGrid-root').first();
note(`  Products DataGrid: ${await invGrid.isVisible().catch(() => false)}`);

// Switch to Stock Levels tab
const stockTab = page.locator('[role="tab"]:has-text("Stock")');
if (await stockTab.isVisible()) {
  await stockTab.click();
  await waitReady();
  await shot('06-inventory-stock');
  note('  Stock Levels tab: clicked ✓');
  const stockGrid = page.locator('.MuiDataGrid-root').first();
  note(`  Stock DataGrid: ${await stockGrid.isVisible().catch(() => false)}`);
}

// Purchase Orders tab
const poTab = page.locator('[role="tab"]:has-text("Purchase")');
if (await poTab.isVisible()) {
  await poTab.click();
  await waitReady();
  await shot('06-inventory-po');
  note('  Purchase Orders tab: clicked ✓');
}

// ─── 7. BILLING / POS ─────────────────────────────────────────────────────
note('\n=== BILLING / POS ===');
await goto('/billing');
await shot('07-billing');
await checkErrors('billing');

// ─── 8. CHECK-IN ──────────────────────────────────────────────────────────
note('\n=== CHECK-IN ===');
await goto('/checkin');
await shot('08-checkin');
await checkErrors('checkin');

// ─── 9. MARKETING ─────────────────────────────────────────────────────────
note('\n=== MARKETING ===');
await goto('/marketing');
await shot('09-marketing');
await checkErrors('marketing');

const mktGrid = page.locator('.MuiDataGrid-root').first();
note(`  Campaigns DataGrid: ${await mktGrid.isVisible().catch(() => false)}`);

// Templates tab
const templatesTab = page.locator('[role="tab"]:has-text("Templates")');
if (await templatesTab.isVisible()) {
  await templatesTab.click();
  await waitReady();
  await shot('09-marketing-templates');
  note('  Templates tab: clicked ✓');
}

// New Campaign dialog
const allCampsTab = page.locator('[role="tab"]:has-text("All Campaigns")');
if (await allCampsTab.isVisible()) await allCampsTab.click();

const newCampBtn = page.locator('button:has-text("New Campaign")');
if (await newCampBtn.isVisible()) {
  await newCampBtn.click();
  await waitReady();
  await shot('09-new-campaign-dialog');
  note('  New Campaign dialog: opened ✓');
  const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")');
  if (await cancelBtn.isVisible()) { await cancelBtn.click(); await waitReady(); }
}

// ─── 10. REPORTS ──────────────────────────────────────────────────────────
note('\n=== REPORTS ===');
await goto('/reports');
await shot('10-reports-revenue');
await checkErrors('reports-revenue');

const reportsGrid = page.locator('.MuiDataGrid-root').first();
note(`  Revenue DataGrid: ${await reportsGrid.isVisible().catch(() => false)}`);

// Staff tab
const staffRepTab = page.locator('[role="tab"]:has-text("Staff")');
if (await staffRepTab.isVisible()) {
  await staffRepTab.click();
  await waitReady();
  await shot('10-reports-staff');
  note('  Staff tab: clicked ✓');
}

// Services tab
const svcRepTab = page.locator('[role="tab"]:has-text("Services")');
if (await svcRepTab.isVisible()) {
  await svcRepTab.click();
  await waitReady();
  await shot('10-reports-services');
  note('  Services tab: clicked ✓');
  const pieChart = page.locator('svg').first();
  note(`  PieChart SVG: ${await pieChart.isVisible().catch(() => false)}`);
}

// Date range selector
const revTab = page.locator('[role="tab"]:has-text("Revenue")');
if (await revTab.isVisible()) await revTab.click();
const dateRangeSelect = page.locator('label:has-text("Date Range")').first();
if (await dateRangeSelect.isVisible()) {
  note('  Date range selector: visible ✓');
}

// ─── 11. SETTINGS ─────────────────────────────────────────────────────────
note('\n=== SETTINGS ===');
await goto('/settings');
await shot('11-settings');
await checkErrors('settings');

// Settings tabs
const settingsTabs = await page.$$('[role="tab"]');
note(`  Settings tabs found: ${settingsTabs.length}`);

for (let i = 0; i < Math.min(settingsTabs.length, 4); i++) {
  await settingsTabs[i].click();
  await waitReady();
  const tabName = await settingsTabs[i].textContent();
  await shot(`11-settings-tab-${i}-${tabName?.trim().replace(/\s+/g, '-').toLowerCase()}`);
  await checkErrors(`settings-tab-${i}`);
  note(`  Settings tab [${tabName?.trim()}]: clicked ✓`);
}

// ─── 12. CALENDAR ─────────────────────────────────────────────────────────
note('\n=== CALENDAR ===');
await goto('/calendar');
await shot('12-calendar');
await checkErrors('calendar');

// ─── SIDEBAR NAVIGATION ───────────────────────────────────────────────────
note('\n=== SIDEBAR NAVIGATION ===');
await goto('/dashboard');
await waitReady();

// Check all sidebar nav links
const navLinks = await page.$$('[role="navigation"] a, nav a, aside a, [data-testid*="nav"] a');
note(`  Sidebar nav links: ${navLinks.length}`);

// ─── CONSOLE ERRORS SUMMARY ──────────────────────────────────────────────
note('\n=== CONSOLE ERRORS SUMMARY ===');
if (consoleErrors.length === 0) {
  note('  No console errors! ✓');
} else {
  note(`  Total console errors: ${consoleErrors.length}`);
  const unique = [...new Map(consoleErrors.map(e => [e.text, e])).values()];
  unique.slice(0, 20).forEach(e => note(`  [${e.url}] ${e.text.substring(0, 200)}`));
}

note('\n=== AUDIT COMPLETE ===');
note(`Total alerts/issues: ${errors.length}`);
errors.forEach(e => note(`  ${e.context}: ${JSON.stringify(e.alerts)}`));

// Save summary
fs.writeFileSync(`${SHOTS}/audit-summary.json`, JSON.stringify({ log, errors, consoleErrors }, null, 2));
note('\nSummary saved to audit-summary.json');

await browser.close();
