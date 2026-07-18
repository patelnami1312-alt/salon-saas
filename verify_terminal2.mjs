import { chromium } from "playwright";
const SHOTS = "C:\Users\Deep\AppData\Local\Temp\claude\e--salon-saas\bfe6d625-33e3-4fe4-aa59-81f3c7e95617\scratchpad";
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80, args: ["--start-maximized"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", "owner@luxebeautylounge.com");
  await page.fill("input[type=password]", "Owner@12345");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(billing|dashboard)/, { timeout: 10000 });
  await page.goto(BASE + "/billing");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOTS + "\pos_01_loaded.png" });

  // Open Check-In dialog → add walk-in to get a client into the queue
  await page.click("button:has-text('Check In')");
  await page.waitForSelector("[role=dialog]", { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.click("button:has-text('Walk-In')");
  await page.waitForTimeout(600);

  // Search for a customer
  const searchInput = page.locator("[role=dialog] input[placeholder*='Mobile']");
  await searchInput.fill("Priya");
  await page.waitForTimeout(1000);

  // Pick first customer if visible
  const custRow = page.locator("[role=dialog] .MuiBox-root").filter({ hasText: /Priya|customer/i }).first();
  const hasCust = await custRow.isVisible().catch(() => false);
  if (hasCust) {
    await custRow.click();
    await page.waitForTimeout(300);
  }

  // Pick a service
  const svcSelect = page.locator("label:has-text('Select Service')").locator("xpath=following::div[1]");
  await svcSelect.click();
  await page.waitForTimeout(600);
  const svcOption = page.locator("[role=listbox] li").first();
  await svcOption.click();
  await page.waitForTimeout(300);
  await page.click("button:has-text('Add to Queue')");
  await page.waitForTimeout(1500);

  // Close check-in dialog
  const closeBtn = page.locator("[role=dialog] button").filter({ hasText: /close|X/i }).last();
  await closeBtn.click().catch(async () => await page.keyboard.press("Escape"));
  await page.waitForTimeout(600);

  // Seat the client (Lobby → InService)
  const seatBtn = page.locator("button:has-text('Seat')").first();
  const hasSeat = await seatBtn.isVisible().catch(() => false);
  if (hasSeat) {
    await seatBtn.click();
    await page.waitForTimeout(1000);
  }

  // Finish the service
  const finishBtn = page.locator("button:has-text('Finish')").first();
  const hasFinish = await finishBtn.isVisible().catch(() => false);
  if (hasFinish) {
    await finishBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: SHOTS + "\pos_02_checkout.png" });

    // Verify 3 payment buttons
    const card = await page.locator("button:has-text('Card')").last().isVisible().catch(() => false);
    const upi  = await page.locator("button:has-text('UPI')").last().isVisible().catch(() => false);
    const cash = await page.locator("button:has-text('Cash')").last().isVisible().catch(() => false);
    const chgCard = await page.locator("button:has-text('Charge')").last().isVisible().catch(() => false);
    console.log("✅ Card btn:", card, "| UPI btn:", upi, "| Cash btn:", cash, "| Charge btn:", chgCard);

    // Click UPI to check it becomes active
    if (upi) {
      await page.locator("button:has-text('UPI')").last().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: SHOTS + "\pos_03_upi_selected.png" });
      const upiCharge = await page.locator("button:has-text('Charge')").last().textContent().catch(() => "");
      console.log("UPI charge btn text:", upiCharge?.trim());
    }

    // Click Card, then Charge — should hit terminal (503 fallback expected)
    await page.locator("button:has-text('Card')").last().click();
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Charge')").last().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SHOTS + "\pos_04_after_charge.png" });
    // Should either show success (fallback manual) or terminal waiting state
    const success = await page.locator("text=Payment Received").isVisible().catch(() => false);
    const waiting = await page.locator("text=/Waiting for|Connecting/").isVisible().catch(() => false);
    const failed  = await page.locator("text=Payment Failed").isVisible().catch(() => false);
    console.log("After charge – success:", success, "| waiting:", waiting, "| failed:", failed);
  } else {
    console.log("⚠️ No Finish button found – queue may be empty");
  }

  await page.waitForTimeout(4000);
  await browser.close();
})();
