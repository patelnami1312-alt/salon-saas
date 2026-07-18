/**
 * Quick targeted checks:
 * 1. Sidebar navigation links
 * 2. TopBar avatar menu
 * 3. Billing page content
 * 4. Appointments filter chips
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = 'e:/salon-saas/screenshots/interaction-test';

async function run() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // ── 1. Sidebar structure analysis ──────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const sidebarLinks = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')];
    return links.slice(0, 20).map(a => ({
      href: a.getAttribute('href'),
      text: a.textContent?.trim().slice(0, 30),
      parentClass: a.parentElement?.className?.slice(0, 40),
    }));
  });
  console.log('\n📌 All <a href> elements found:');
  sidebarLinks.forEach(l => console.log(`  href="${l.href}" text="${l.text}"`));

  // ── 2. TopBar avatar — find the actual element ──────────────────────
  const avatarInfo = await page.evaluate(() => {
    const avatars = [...document.querySelectorAll('.MuiAvatar-root')];
    return avatars.map(a => ({
      text: a.textContent?.trim(),
      tagName: a.tagName,
      parentTag: a.parentElement?.tagName,
      grandparentTag: a.parentElement?.parentElement?.tagName,
      classes: a.className.slice(0, 60),
    }));
  });
  console.log('\n📌 Avatar elements:', JSON.stringify(avatarInfo, null, 2));

  // Click the avatar properly (it's inside a button)
  try {
    const avatarButton = page.locator('button').filter({ has: page.locator('.MuiAvatar-root') });
    const count = await avatarButton.count();
    console.log(`\n📌 Avatar buttons found: ${count}`);
    if (count > 0) {
      await avatarButton.first().click();
      await page.waitForTimeout(500);
      const menuVisible = await page.locator('[role="menu"]').isVisible({ timeout: 1500 });
      console.log(`✅ Avatar menu visible: ${menuVisible}`);
      if (menuVisible) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'topbar-profile-menu-correct.png') });
        const menuItems = await page.locator('[role="menuitem"]').allTextContents();
        console.log('Menu items:', menuItems);
      }
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    console.log('❌ Avatar click error:', e.message);
  }

  // ── 3. Sidebar nav links — find correct selectors ──────────────────
  const listItems = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.MuiListItem-root, .MuiListItemButton-root')];
    return items.slice(0, 15).map(el => ({
      text: el.textContent?.trim().slice(0, 30),
      tagName: el.tagName,
      role: el.getAttribute('role'),
    }));
  });
  console.log('\n📌 MuiListItem elements (sidebar nav):');
  listItems.forEach(i => console.log(`  "${i.text}" [${i.tagName}]`));

  // Test clicking sidebar items
  try {
    const customersNav = page.locator('.MuiListItemButton-root').filter({ hasText: /customers/i });
    const count2 = await customersNav.count();
    console.log(`\n📌 Customers nav button count: ${count2}`);
    if (count2 > 0) {
      await customersNav.first().click();
      await page.waitForTimeout(800);
      console.log(`✅ Navigated to: ${page.url()}`);
    }
  } catch (e) {
    console.log('❌ Sidebar nav click error:', e.message);
  }

  // ── 4. Billing page content ─────────────────────────────────────────
  await page.goto(`${BASE}/billing`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const billingInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const headings = [...document.querySelectorAll('h4, h5, h6')].map(h => h.textContent?.trim());
    return {
      buttonTexts: btns.map(b => b.textContent?.trim().slice(0, 30)).filter(Boolean),
      headings,
    };
  });
  console.log('\n📌 Billing page buttons:', billingInfo.buttonTexts);
  console.log('📌 Billing page headings:', billingInfo.headings);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'billing-full.png'), fullPage: true });

  // ── 5. Appointments filters ─────────────────────────────────────────
  await page.goto(`${BASE}/appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const apptInfo = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const chips = [...document.querySelectorAll('.MuiChip-root:not(.MuiDataGrid-root .MuiChip-root)')];
    const btns = [...document.querySelectorAll('button')].map(b => b.textContent?.trim().slice(0, 30)).filter(Boolean);
    return {
      tabs: tabs.map(t => t.textContent?.trim()),
      chips: chips.slice(0, 10).map(c => c.textContent?.trim()),
      buttons: btns,
    };
  });
  console.log('\n📌 Appointments - tabs:', apptInfo.tabs);
  console.log('📌 Appointments - chips:', apptInfo.chips);
  console.log('📌 Appointments - buttons:', apptInfo.buttons);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'appointments-full.png'), fullPage: true });

  await page.close();
  await browser.close();
  console.log('\n✅ Quick check complete');
}

run().catch(console.error);
