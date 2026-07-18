import { chromium } from 'playwright';
const OUT = 'C:/Users/Deep/AppData/Local/Temp/visual_audit';
const b = await chromium.launch({ headless: false, slowMo: 60 });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

// Watch network calls
const requests = [];
p.on('request', r => { if (r.url().includes('/api/')) requests.push({ type: 'req', url: r.url().replace(/.*\/api/, '/api') }); });
p.on('response', r => { if (r.url().includes('/api/')) requests.push({ type: 'res', url: r.url().replace(/.*\/api/, '/api'), status: r.status() }); });

await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

// Clear any stored tokens for clean test
await p.evaluate(() => { localStorage.clear(); });
await p.reload();
await p.waitForTimeout(1000);

console.log('\n--- Testing: correct email + wrong password ---');
await p.fill('input[type=email]', 'admin@salonsaas.com');
await p.locator('input[type=password]').fill('WrongPass123');
requests.length = 0;
await p.click('button[type=submit]');

// Poll every 300ms for 6 seconds to track state
for (let i = 1; i <= 20; i++) {
  await p.waitForTimeout(300);
  const ms = i * 300;

  // Get Redux auth state via JS evaluation
  const state = await p.evaluate(() => {
    // RTK store is not directly accessible, check DOM instead
    const btn = document.querySelector('button[type=submit]');
    const alert = document.querySelector('[role=alert]');
    const muiAlert = document.querySelector('.MuiAlert-root');
    const anyError = document.querySelector('[class*="error"]:not(input):not(label)');
    return {
      buttonText: btn?.textContent?.trim(),
      buttonDisabled: btn?.disabled,
      alertVisible: alert ? window.getComputedStyle(alert).display !== 'none' && window.getComputedStyle(alert).visibility !== 'hidden' && parseFloat(window.getComputedStyle(alert).opacity) > 0.1 : null,
      alertText: alert?.textContent?.trim(),
      muiAlertVisible: muiAlert ? window.getComputedStyle(muiAlert).display !== 'none' : null,
      muiAlertText: muiAlert?.textContent?.trim(),
      anyErrorVisible: anyError ? window.getComputedStyle(anyError).display !== 'none' : null,
      anyErrorText: anyError?.textContent?.trim()?.slice(0, 50),
    };
  });

  console.log(`  ${ms}ms:`, JSON.stringify(state));

  // If error is visible, take screenshot immediately
  if (state.alertVisible || state.muiAlertVisible) {
    await p.screenshot({ path: `${OUT}/login_debug_error_VISIBLE_${ms}ms.png` });
    console.log(`  *** ERROR VISIBLE at ${ms}ms! Screenshot taken ***`);
  }

  if (ms === 1500) {
    await p.screenshot({ path: `${OUT}/login_debug_1500ms.png` });
  }
  if (ms === 3000) {
    await p.screenshot({ path: `${OUT}/login_debug_3000ms.png` });
  }
}

// Final state
await p.screenshot({ path: `${OUT}/login_debug_final.png` });
console.log('\nNetwork calls during test:');
requests.forEach(r => console.log(`  ${r.type.toUpperCase()} ${r.url}${r.status ? ' → ' + r.status : ''}`));

await b.close();
