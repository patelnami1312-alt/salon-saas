/**
 * UI Visual Validator — Desktop (1440×900) + Tablet (768×1024)
 * Connects via Playwright CDP to existing Chrome instance
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE   = 'http://localhost:3000';
const OUTDIR = 'e:/salon-saas/screenshots/visual-validation';
fs.mkdirSync(`${OUTDIR}/desktop`, { recursive: true });
fs.mkdirSync(`${OUTDIR}/tablet`,  { recursive: true });

const PAGES = [
  { path: '/dashboard',          label: 'dashboard' },
  { path: '/appointments',       label: 'appointments' },
  { path: '/calendar',           label: 'calendar' },
  { path: '/checkin',            label: 'checkin' },
  { path: '/customers',          label: 'customers' },
  { path: '/staff',              label: 'staff' },
  { path: '/services',           label: 'services' },
  { path: '/billing',            label: 'billing' },
  { path: '/inventory/products', label: 'inventory-products' },
  { path: '/inventory/stock',    label: 'inventory-stock' },
  { path: '/marketing',          label: 'marketing' },
  { path: '/reports/revenue',    label: 'reports-revenue' },
  { path: '/reports/staff',      label: 'reports-staff' },
  { path: '/reports/services',   label: 'reports-services' },
  { path: '/settings',           label: 'settings' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900  },
  { name: 'tablet',  width: 768,  height: 1024 },
];

// ── helpers ─────────────────────────────────────────────────────────────────
async function checkOverflow(page) {
  return page.evaluate(() => {
    const overflowing = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
        const tag  = el.tagName.toLowerCase();
        const cls  = [...el.classList].slice(0, 2).join('.');
        const text = el.textContent?.trim().substring(0, 40) ?? '';
        overflowing.push(`${tag}.${cls}: scrollW=${el.scrollWidth} clientW=${el.clientWidth} "${text}"`);
      }
    });
    return [...new Set(overflowing)].slice(0, 8);
  });
}

async function checkHiddenButtons(page, vp) {
  return page.evaluate((vpw) => {
    const hidden = [];
    document.querySelectorAll('button, [role="button"]').forEach(btn => {
      const r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vpw + 10 || r.left < -10) {
        hidden.push(`"${btn.textContent?.trim().substring(0, 30)}" at x=${Math.round(r.left)}`);
      }
    });
    return hidden.slice(0, 5);
  }, vp.width);
}

async function checkTextClipping(page) {
  return page.evaluate(() => {
    const clipped = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,.MuiTypography-root').forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 4) {
        clipped.push(`"${el.textContent?.trim().substring(0, 40)}" (${el.className.split(' ')[0]})`);
      }
    });
    return clipped.slice(0, 5);
  });
}

async function checkMuiGrid(page) {
  return page.evaluate(() => {
    const grids = document.querySelectorAll('.MuiDataGrid-root');
    return {
      count: grids.length,
      heights: [...grids].map(g => g.getBoundingClientRect().height),
    };
  });
}

async function checkSidebar(page, vp) {
  return page.evaluate((vpw) => {
    const sidebar = document.querySelector('[class*="MuiDrawer"],[class*="sidebar"],[aria-label*="sidebar" i],[aria-label*="navigation" i]')
                 ?? document.querySelector('nav');
    if (!sidebar) return { found: false };
    const r = sidebar.getBoundingClientRect();
    return {
      found:   true,
      visible: r.width > 0 && r.height > 0,
      width:   Math.round(r.width),
      offscreen: r.right > vpw,
    };
  }, vp.width);
}

async function checkCharts(page) {
  return page.evaluate(() => ({
    axes:    document.querySelectorAll('[class*="MuiChartsAxis"]').length,
    bars:    document.querySelectorAll('[class*="MuiBarElement"]').length,
    arcs:    document.querySelectorAll('[class*="MuiPieArc"]').length,
    areas:   document.querySelectorAll('[class*="MuiAreaElement"]').length,
    legends: document.querySelectorAll('[class*="MuiChartsLegend"]').length,
  }));
}

async function checkOverlap(page) {
  return page.evaluate(() => {
    // Check if any dialog/modal is open (unexpected)
    const dialogs = document.querySelectorAll('[role="dialog"]');
    // Check for z-index conflicts in key containers
    const toasts = document.querySelectorAll('[class*="Toaster"],[class*="toast" i],[class*="snackbar" i]');
    return {
      openDialogs: dialogs.length,
      toasts:      toasts.length,
    };
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];

const issues  = [];
const summary = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}×${vp.height})`);
  console.log('═'.repeat(60));

  for (const pg of PAGES) {
    await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // ── full-page screenshot ──
    const shotPath = `${OUTDIR}/${vp.name}/${pg.label}.png`;
    await page.screenshot({ path: shotPath, fullPage: true });

    // ── run all checks ──
    const [overflow, hiddenBtns, clipped, grid, sidebar, charts, overlap] = await Promise.all([
      checkOverflow(page),
      checkHiddenButtons(page, vp),
      checkTextClipping(page),
      checkMuiGrid(page),
      checkSidebar(page, vp),
      checkCharts(page),
      checkOverlap(page),
    ]);

    const pageIssues = [];

    if (overflow.length)   overflow.forEach(o => pageIssues.push(`⚠️  Overflow: ${o}`));
    if (hiddenBtns.length) hiddenBtns.forEach(b => pageIssues.push(`⚠️  Button off-screen: ${b}`));
    if (clipped.length)    clipped.forEach(c => pageIssues.push(`⚠️  Text clipped: ${c}`));
    if (!sidebar.found)    pageIssues.push(`❌ Sidebar: not found in DOM`);
    else if (!sidebar.visible) pageIssues.push(`❌ Sidebar: found but invisible (${vp.name})`);
    else if (sidebar.offscreen) pageIssues.push(`❌ Sidebar: extends offscreen (width=${sidebar.width})`);
    if (overlap.openDialogs > 0) pageIssues.push(`⚠️  Unexpected open dialog`);

    // Grid checks
    if (['appointments','customers','staff','inventory-products','inventory-stock','marketing'].includes(pg.label)) {
      if (grid.count === 0) pageIssues.push(`❌ DataGrid: expected 1, found 0`);
      else grid.heights.forEach((h,i) => {
        if (h < 50) pageIssues.push(`❌ DataGrid #${i+1}: height only ${Math.round(h)}px (collapsed?)`);
      });
    }

    // Chart checks (dashboard only)
    if (pg.label === 'dashboard') {
      if (charts.axes  < 10) pageIssues.push(`❌ LineChart: expected axes, found ${charts.axes}`);
      if (charts.bars  < 5)  pageIssues.push(`❌ BarChart: expected bars, found ${charts.bars}`);
      if (charts.arcs  < 3)  pageIssues.push(`❌ PieChart: expected arcs, found ${charts.arcs}`);
    }

    const status = pageIssues.length === 0 ? '✅' : '⚠️ ';
    const sidebarInfo = sidebar.found ? `sidebar=${sidebar.width}px` : 'no-sidebar';
    const gridInfo    = grid.count > 0 ? `grid×${grid.count}` : '';
    const chartInfo   = pg.label === 'dashboard' ? `axes=${charts.axes} bars=${charts.bars} arcs=${charts.arcs}` : '';

    console.log(`${status} [${vp.name}/${pg.label}] ${sidebarInfo} ${gridInfo} ${chartInfo}`);
    pageIssues.forEach(i => console.log(`     ${i}`));

    if (pageIssues.length) {
      issues.push({ viewport: vp.name, page: pg.label, problems: pageIssues });
    }
    summary.push({ viewport: vp.name, page: pg.label, status, issueCount: pageIssues.length });
  }
}

// ── tablet-specific sidebar collapse check ────────────────────────────────
console.log('\n──── TABLET SIDEBAR COLLAPSE TEST ────');
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);

// Look for hamburger / collapse button
const hamburger = page.locator('[aria-label*="menu" i],[aria-label*="toggle" i],[aria-label*="collapse" i],button:has(svg[data-testid*="Menu"])').first();
const hasHamburger = await hamburger.isVisible().catch(() => false);
console.log(`  Hamburger/toggle button: ${hasHamburger ? '✅ present' : '⚠️  not detected (sidebar may always be visible)'}`);

// Check if sidebar overlaps content at 768px
const sidebarWidth = await page.evaluate(() => {
  const s = document.querySelector('[class*="MuiDrawer-paper"]');
  return s ? s.getBoundingClientRect().width : 0;
});
const contentWidth = await page.evaluate(() => {
  const c = document.querySelector('main,[class*="MuiBox-root"]:not([class*="Drawer"])');
  return c ? c.getBoundingClientRect().width : 0;
});
console.log(`  Sidebar width: ${Math.round(sidebarWidth)}px, Content width: ${Math.round(contentWidth)}px`);
if (sidebarWidth > 0 && contentWidth > 0 && sidebarWidth + contentWidth > 800) {
  console.log(`  ⚠️  Sidebar (${Math.round(sidebarWidth)}px) + content (${Math.round(contentWidth)}px) may overflow on 768px tablet`);
}
await page.screenshot({ path: `${OUTDIR}/tablet/tablet-sidebar-check.png`, fullPage: false });

// ── final report ──────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('VISUAL VALIDATION REPORT');
console.log('═'.repeat(60));

const okCount  = summary.filter(s => s.status === '✅').length;
const errCount = summary.filter(s => s.status !== '✅').length;
console.log(`Total pages tested: ${summary.length} (${PAGES.length} pages × ${VIEWPORTS.length} viewports)`);
console.log(`Passed: ${okCount}  Issues: ${errCount}`);

if (issues.length === 0) {
  console.log('\n✅ No visual issues detected across all pages and viewports!');
} else {
  console.log('\n── Issues by page ──');
  issues.forEach(({ viewport, page, problems }) => {
    console.log(`\n[${viewport}] ${page}:`);
    problems.forEach(p => console.log(`  ${p}`));
  });
}

console.log(`\nScreenshots saved to: ${OUTDIR}/`);
await browser.close();
