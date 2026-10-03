const { chromium } = require('@playwright/test');
const path = require('path');

async function main() {
  try {
    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome'
    }).catch(async () => {
      return await chromium.launch({ headless: true });
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    const artifactDir = path.resolve('C:/Users/khale/.gemini/antigravity-ide/brain/b0bb5635-0cf3-4acb-83b4-a789bd521593');

    // Helper: accept cookies
    async function dismissCookies() {
      try {
        const acceptCookies = page.locator('button:has-text("ACCEPT ALL"), button:has-text("Accept")').first();
        if (await acceptCookies.isVisible({ timeout: 1500 })) {
          await acceptCookies.click();
          await page.waitForTimeout(400);
        }
      } catch (e) {}
    }

    console.log('Navigating to Shop page to view footer...');
    await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await dismissCookies();

    // Scroll to footer
    const footerElement = page.locator('footer').first();
    await footerElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // 1. Desktop Footer Screenshot
    const desktopScreenshot = path.join(artifactDir, 'footer_desktop_restyled.png');
    await footerElement.screenshot({ path: desktopScreenshot });
    console.log('Saved desktop footer screenshot:', desktopScreenshot);

    // 2. Mobile Viewport Screenshot (Closed accordions)
    await page.setViewportSize({ width: 390, height: 844 });
    await footerElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const mobileClosedScreenshot = path.join(artifactDir, 'footer_mobile_accordions_closed.png');
    await footerElement.screenshot({ path: mobileClosedScreenshot });
    console.log('Saved mobile footer (closed) screenshot:', mobileClosedScreenshot);

    // 3. Mobile Viewport Screenshot (Open Service & Policies accordions)
    const serviceBtn = page.locator('button.wt-collapse__trigger:has-text("Service")').first();
    const policiesBtn = page.locator('button.wt-collapse__trigger:has-text("Policies")').first();
    if (await serviceBtn.isVisible()) {
      await serviceBtn.click();
      await page.waitForTimeout(300);
    }
    if (await policiesBtn.isVisible()) {
      await policiesBtn.click();
      await page.waitForTimeout(300);
    }

    await footerElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const mobileOpenScreenshot = path.join(artifactDir, 'footer_mobile_accordions_open.png');
    await footerElement.screenshot({ path: mobileOpenScreenshot });
    console.log('Saved mobile footer (open) screenshot:', mobileOpenScreenshot);

    await browser.close();
    console.log('All footer screenshots captured successfully!');
  } catch (err) {
    console.error('Footer capture error:', err.message);
  }
}

main();
