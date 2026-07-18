import { chromium } from 'playwright';

let idx = 1;
const shots = [];
const findings = [];

async function shot(p, name) {
  const f = `C:/Users/Deep/AppData/Local/Temp/ss_${String(idx++).padStart(2,'0')}_${name.replace(/[^a-z0-9]/gi,'_')}.png`;
  await p.screenshot({ path: f });
  shots.push({ name, file: f });
  console.log('  📸', name);
  return f;
}

async function waitAndShot(p, name, selector, timeout = 8000) {
  try {
    await p.waitForSelector(selector, { timeout });
    await shot(p, name);
    return true;
  } catch {
    findings.push(`MISSING  ${name}: "${selector}" not found after ${timeout}ms`);
    await shot(p, name + '_TIMEOUT');
    return false;
  }
}

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const errors = [];
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message));

// 1. Landing redirect
console.log('\n[1] Landing');
await p.goto('http://localhost:3000', { timeout: 20000 });
await p.waitForSelector('input[type=email], .MuiDrawer-root', { timeout: 12000 }).catch(() => {});
const url1 = p.url();
console.log('  URL:', url1);
await shot(p, '01_landing');
const onLogin = url1.includes('login') || !!(await p.$('input[type=email]'));
console.log('  Redirected to login:', onLogin);
if (!onLogin) findings.push('Landing did not redirect to /login for unauthenticated user');

// 2. Login page visible
console.log('\n[2] Login page');
if (!url1.includes('login')) await p.goto('http://localhost:3000/login', { timeout: 10000 });
await p.waitForSelector('input[type=email]', { timeout: 8000 });
await shot(p, '02_login');

// 3. Wrong credentials
console.log('\n[3] Wrong credentials');
await p.fill('input[type=email]', 'wrong@test.com');
await p.fill('input[type=password]', 'badpassword');
await p.click('button[type=submit]');
await p.waitForTimeout(2500);
await shot(p, '03_wrong_creds');
const hasErrAlert = !!(await p.$('.MuiAlert-root'));
console.log('  Error alert shown:', hasErrAlert);
if (!hasErrAlert) findings.push('No error alert on wrong credentials');

// 4. Correct login
console.log('\n[4] Correct login');
await p.fill('input[type=email]', 'admin@salonsaas.com');
await p.fill('input[type=password]', 'Admin@12345');
await p.click('button[type=submit]');
await p.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
await p.waitForSelector('.MuiDrawer-root, nav', { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(2000);
await shot(p, '04_dashboard');
console.log('  URL after login:', p.url());
if (!p.url().includes('dashboard')) findings.push('Login did not navigate to /dashboard');
const dashContent = await p.content();
const hasStats = dashContent.includes('Revenue') || dashContent.includes('Appointment') || dashContent.includes('Customer') || dashContent.includes('Today');
console.log('  Dashboard has stats:', hasStats);
if (!hasStats) findings.push('Dashboard appears empty');

// 5. Customers
console.log('\n[5] Customers');
await p.goto('http://localhost:3000/customers');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1200);
await shot(p, '05_customers');
const custGrid = !!(await p.$('.MuiDataGrid-root'));
console.log('  DataGrid present:', custGrid);
if (!custGrid) findings.push('Customers: no data grid found');

// 6. Staff
console.log('\n[6] Staff');
await p.goto('http://localhost:3000/staff');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1200);
await shot(p, '06_staff');

// 7. Appointments
console.log('\n[7] Appointments');
await p.goto('http://localhost:3000/appointments');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1200);
await shot(p, '07_appointments');

// 8. Calendar
console.log('\n[8] Calendar');
await p.goto('http://localhost:3000/calendar');
await p.waitForSelector('.fc-view-harness', { timeout: 10000 }).catch(() => {});
await p.waitForTimeout(1500);
await shot(p, '08_calendar');
const hasFC = !!(await p.$('.fc-view-harness'));
console.log('  FullCalendar rendered:', hasFC);
if (!hasFC) findings.push('Calendar: FullCalendar did not render');

// 9. Calendar dateClick booking dialog
console.log('\n[9] Calendar dateClick booking flow');
if (hasFC) {
  const timeGrid = await p.$('.fc-timegrid-body');
  if (timeGrid) {
    const box = await timeGrid.boundingBox();
    if (box) {
      await p.mouse.click(box.x + box.width * 0.35, box.y + 140);
      await p.waitForTimeout(900);
    }
  }
  const dlg = await p.$('[role=dialog]');
  console.log('  Booking dialog opened:', !!dlg);
  await shot(p, '09a_booking_step1');

  if (!dlg) {
    findings.push('Calendar dateClick: booking dialog did not open');
  } else {
    // Service chips
    const chips = await p.$$('[role=dialog] .MuiChip-clickable');
    console.log('  Service chips found:', chips.length);
    if (chips.length > 0) {
      await chips[0].click();
      await p.waitForTimeout(400);
      await shot(p, '09b_service_selected');
      // Next button
      const nextBtn = p.getByRole('dialog').getByRole('button', { name: 'Next' });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await p.waitForTimeout(2500);
        await shot(p, '09c_time_slots');
        const slotChips = await p.$$('[role=dialog] .MuiChip-clickable');
        const noSlotAlert = await p.$('[role=dialog] .MuiAlert-root');
        console.log('  Time slots:', slotChips.length, '| No-slot alert:', !!noSlotAlert);
        if (slotChips.length > 0) {
          await slotChips[0].click();
          await p.waitForTimeout(300);
          const next2 = p.getByRole('dialog').getByRole('button', { name: 'Next' });
          if (await next2.isEnabled().catch(() => false)) {
            await next2.click();
            await p.waitForTimeout(600);
            await shot(p, '09d_customer_step');
          }
        }
      }
    }
    const cancelBtn = p.getByRole('dialog').getByRole('button', { name: 'Cancel' });
    await cancelBtn.click().catch(() => {});
    await p.waitForTimeout(400);
  }
}

// 10. Check-In
console.log('\n[10] Check-In');
await p.goto('http://localhost:3000/checkin');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1000);
await shot(p, '10_checkin');

// 11. Billing
console.log('\n[11] Billing/POS');
await p.goto('http://localhost:3000/billing');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1000);
await shot(p, '11_billing');

// 12. Inventory
console.log('\n[12] Inventory');
for (const [tab, route] of [['products','products'],['stock','stock'],['orders','orders']]) {
  await p.goto(`http://localhost:3000/inventory/${route}`);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1000);
  await shot(p, `12_inventory_${tab}`);
}

// 13. Reports
console.log('\n[13] Reports');
for (const tab of ['revenue','staff','services','customers','inventory']) {
  await p.goto(`http://localhost:3000/reports/${tab}`);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1500);
  await shot(p, `13_reports_${tab}`);
}

// 14. Services
console.log('\n[14] Services');
await p.goto('http://localhost:3000/services');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1000);
await shot(p, '14_services');

// 15. Marketing
console.log('\n[15] Marketing');
await p.goto('http://localhost:3000/marketing');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1000);
await shot(p, '15_marketing');

// 16. Settings
console.log('\n[16] Settings');
await p.goto('http://localhost:3000/settings');
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1000);
await shot(p, '16_settings');

// 17. 404
console.log('\n[17] 404');
await p.goto('http://localhost:3000/xyz-does-not-exist');
await p.waitForTimeout(1000);
await shot(p, '17_404');
const notFound = (await p.content()).toLowerCase().includes('not found') || (await p.content()).includes('404');
console.log('  404 page:', notFound);
if (!notFound) findings.push('404 page not showing for unknown routes');

// 18. Probe: /login when authenticated
console.log('\n[18] Probe: /login when already authed');
await p.goto('http://localhost:3000/login');
await p.waitForTimeout(1200);
console.log('  URL:', p.url());
await shot(p, '18_login_while_authed');

// Summary
console.log('\n\n=== CONSOLE ERRORS ===');
const relErrors = errors.filter(e => !e.includes('favicon') && !e.includes('Download the React DevTools'));
if (relErrors.length === 0) console.log('None');
else relErrors.slice(0,20).forEach(e => console.log(' ⚠', e.substring(0,280)));

console.log('\n=== FINDINGS ===');
if (findings.length === 0) console.log('None - all checks passed');
else findings.forEach(f => console.log(' -', f));

await b.close();
console.log(`\nDone. ${shots.length} screenshots taken.`);
