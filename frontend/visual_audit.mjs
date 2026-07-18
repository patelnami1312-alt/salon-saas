import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = 'C:/Users/Deep/AppData/Local/Temp/visual_audit';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const b = await chromium.launch({ headless: false, slowMo: 80 });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

// Collect console errors and page crashes
const errors = [];
p.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
p.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

const issues = [];
const ok = (msg) => console.log('  ✅ ' + msg);
const bug = (msg, note = '') => { console.error('  🐛 ' + msg + (note ? ' — ' + note : '')); issues.push(msg); };
const sec = (t) => console.log(`\n${'═'.repeat(56)}\n  ${t}\n${'═'.repeat(56)}`);

async function shot(name) {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`     📸 ${name}.png`);
}
async function wait(ms = 2000) {
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(ms);
}

// ── 1. LOGIN PAGE ──────────────────────────────────────────
sec('1 · Login — visual & error states');
await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await wait(1000);
await shot('login_01_initial');

// Check login page looks correct
const loginTitle = await p.locator('h1,h2,h3,h4,h5,h6,[class*="title"]').first().textContent().catch(() => '');
console.log(`     Login heading: "${loginTitle}"`);

// Empty form submit — check validation messages
await p.click('button[type=submit]');
await wait(800);
await shot('login_02_empty_submit_validation');
const emptyErrors = await p.locator('[class*="error"],[class*="helper"],[aria-invalid=true]').count();
console.log(`     Validation indicators: ${emptyErrors}`);
if (emptyErrors === 0) bug('No visible validation on empty submit', 'Fields should show error state');
else ok(`Empty submit shows ${emptyErrors} validation indicator(s)`);

// Wrong email format
await p.fill('input[type=email]', 'notanemail');
await p.fill('input[type=text], input[type=password]', 'test123').catch(() => {});
await p.click('button[type=submit]');
await wait(800);
await shot('login_03_invalid_email_format');

// Wrong credentials — this is the KEY test
await p.fill('input[type=email]', 'wrong@email.com');
await p.locator('input[type=password], input[type=text]').last().fill('wrongpassword');
await shot('login_04_wrong_creds_filled');
await p.click('button[type=submit]');
await wait(3000);
await shot('login_05_wrong_creds_response');

// Check what happened
const stillOnLogin = p.url().includes('/login');
const errorAlert = await p.locator('[role=alert],[class*="error"],[class*="alert"],[class*="snack"],[class*="toast"]').first().isVisible().catch(() => false);
const errorText = await p.locator('[role=alert],[class*="error"],[class*="alert"]').first().textContent().catch(() => '');
console.log(`     Still on login: ${stillOnLogin}`);
console.log(`     Error alert visible: ${errorAlert}`);
console.log(`     Error text: "${errorText}"`);

if (!stillOnLogin) bug('Wrong credentials navigated AWAY from login page', 'should stay on /login');
else ok('Wrong credentials stays on login page');
if (!errorAlert) bug('No error message shown for wrong credentials', 'user has no feedback');
else ok(`Error message shown: "${errorText.trim().slice(0,60)}"`);

// Wrong password for correct email
await p.fill('input[type=email]', 'admin@salonsaas.com');
await p.locator('input[type=password], input[type=text]').last().fill('WrongPass123');
await p.click('button[type=submit]');
await wait(3000);
await shot('login_06_correct_email_wrong_pass');
const errorAlert2 = await p.locator('[role=alert],[class*="error"],[class*="alert"],[class*="snack"]').first().isVisible().catch(() => false);
if (!errorAlert2) bug('No error shown: correct email + wrong password', 'user gets no feedback');
else ok('Error shown for correct email + wrong password');

// ── 2. SUCCESSFUL LOGIN + ALL PAGE LOADING ────────────────
sec('2 · Successful login');
await p.fill('input[type=email]', 'admin@salonsaas.com');
await p.locator('input[type=password], input[type=text]').last().fill('Admin@12345');
await p.click('button[type=submit]');
await p.waitForURL(/\/(dashboard|customers|appointments)/, { timeout: 15000 });
await wait(3000);
await shot('app_01_after_login');
ok(`Logged in → ${p.url().split('3000')[1]}`);

// ── 3. CHECK ALL PAGES FOR "SOMETHING WENT WRONG" ─────────
sec('3 · Page-by-page error scan');

const pages = [
  { name: 'dashboard',       url: '/dashboard' },
  { name: 'customers',       url: '/customers' },
  { name: 'staff',           url: '/staff' },
  { name: 'appointments',    url: '/appointments' },
  { name: 'calendar',        url: '/calendar' },
  { name: 'checkin',         url: '/checkin' },
  { name: 'billing',         url: '/billing' },
  { name: 'inventory',       url: '/inventory/products' },
  { name: 'services',        url: '/services' },
  { name: 'marketing',       url: '/marketing' },
  { name: 'reports_revenue', url: '/reports/revenue' },
  { name: 'reports_staff',   url: '/reports/staff' },
  { name: 'settings',        url: '/settings' },
  { name: 'notifications',   url: '/notifications' },
];

const ERROR_PATTERNS = [
  'something went wrong',
  'error boundary',
  'unexpected error',
  'cannot read',
  'is not a function',
  'undefined',
  'null',
  '404',
  'not found',
  'oops',
  'failed to load',
  'network error',
];

for (const pg of pages) {
  errors.length = 0; // clear console errors
  await p.goto(`http://localhost:3000${pg.url}`);
  await wait(2500);

  const bodyText = (await p.locator('body').innerText()).toLowerCase();
  const foundErrors = ERROR_PATTERNS.filter(pat => bodyText.includes(pat));

  // Check for error boundary / crash
  const errorBoundary = await p.locator('[class*="error-boundary"], [class*="ErrorBoundary"]').isVisible().catch(() => false);
  const hasErrorHeading = await p.locator('h1:has-text("Error"), h2:has-text("Wrong"), h3:has-text("Failed")').isVisible().catch(() => false);

  if (foundErrors.length > 0 || errorBoundary || hasErrorHeading) {
    await shot(`page_ERROR_${pg.name}`);
    bug(`"${pg.name}" has error text: ${foundErrors.join(', ')}`,
        `URL: ${pg.url}`);
  } else {
    await shot(`page_ok_${pg.name}`);
    ok(`${pg.name} → loads cleanly`);
  }

  if (errors.length > 0) {
    console.log(`     ⚠️  Console errors on ${pg.name}:`);
    errors.slice(0, 3).forEach(e => console.log(`        • ${e.slice(0, 120)}`));
  }
}

// ── 4. DEEP LOGIN ERROR UI TEST ───────────────────────────
sec('4 · Logout then retest login error UI');
// Logout first
await p.goto('http://localhost:3000/dashboard');
await wait(1000);
await p.locator('[aria-label="Logout"], button:has-text("Logout")').first().click().catch(async () => {
  // Try sidebar logout
  await p.locator('.MuiListItemButton-root:has-text("Logout")').click().catch(() => {});
});
await wait(1500);
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await p.goto('http://localhost:3000/login');
await wait(1000);
await shot('retest_login_fresh');

// Test all wrong credential scenarios with screenshots
const scenarios = [
  { email: '', pass: '', label: 'both_empty' },
  { email: 'bad', pass: '', label: 'invalid_email_no_pass' },
  { email: 'nouser@test.com', pass: 'wrongpass', label: 'nonexistent_user' },
  { email: 'admin@salonsaas.com', pass: 'wrong', label: 'correct_email_wrong_pass' },
];

for (const s of scenarios) {
  await p.reload();
  await wait(800);
  if (s.email) await p.fill('input[type=email]', s.email);
  if (s.pass) await p.locator('input[type=password]').fill(s.pass).catch(async() => {
    await p.locator('input').nth(1).fill(s.pass);
  });
  await p.click('button[type=submit]');
  await wait(2500);
  await shot(`login_scenario_${s.label}`);

  const url = p.url();
  const hasErr = await p.locator('[role=alert],[class*="MuiAlert"],[class*="error"],[class*="Snack"]')
    .first().isVisible().catch(() => false);
  const errTxt = await p.locator('[role=alert],[class*="MuiAlert"],[class*="error"]')
    .first().textContent().catch(() => '');
  const onLogin = url.includes('/login');

  console.log(`     [${s.label}] on-login=${onLogin} error-visible=${hasErr} text="${errTxt.trim().slice(0,50)}"`);
  if (!onLogin) bug(`Scenario "${s.label}" left /login page`, url);
  if (!hasErr && (s.email || s.pass)) bug(`No error feedback for scenario "${s.label}"`);
}

// ── 5. SUMMARY ────────────────────────────────────────────
console.log(`\n${'═'.repeat(56)}`);
console.log(`  ISSUES FOUND: ${issues.length}`);
if (issues.length > 0) {
  issues.forEach((iss, i) => console.log(`  ${i + 1}. ${iss}`));
} else {
  console.log('  No issues found!');
}
console.log('═'.repeat(56));
console.log(`\n  Screenshots saved to: ${OUT}`);

await b.close();
