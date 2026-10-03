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

    // 1. HERO (Landing Page)
    console.log('Navigating to Landing Page (Hero)...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3200); // splash animation
    await dismissCookies();
    const heroScreenshot = path.join(artifactDir, 'hero_restyled.png');
    await page.screenshot({ path: heroScreenshot, fullPage: false });
    console.log('Saved Hero screenshot:', heroScreenshot);

    // 2. SHOP PAGE (Grid cards)
    console.log('Navigating to Shop Grid...');
    await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await dismissCookies();
    const shopScreenshot = path.join(artifactDir, 'shop_grid_restyled.png');
    await page.screenshot({ path: shopScreenshot, fullPage: false });
    console.log('Saved shop grid screenshot:', shopScreenshot);

    // 3. QUICK VIEW & HOVER SWAP
    console.log('Hovering over first product card...');
    const firstCard = page.locator('div[role="link"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.hover();
      await page.waitForTimeout(600);
      const quickViewScreenshot = path.join(artifactDir, 'quick_view_hover.png');
      await page.screenshot({ path: quickViewScreenshot, fullPage: false });
      console.log('Saved Quick View / Card Hover screenshot:', quickViewScreenshot);
    }

    // 4. CART DRAWER: EMPTY STATE & LOGIN NUDGE
    console.log('Testing Cart Drawer: Empty State...');
    // Clear cart in localStorage to ensure empty state
    await page.evaluate(() => localStorage.removeItem('vbfits_cart'));
    await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await dismissCookies();

    // Open cart drawer while empty
    const headerCartBtn = page.locator('header button[aria-label*="cart" i], header button[aria-label*="bag" i], header button:has(img[src*="cart"])').first();
    await headerCartBtn.click();
    await page.waitForTimeout(500);

    const cartEmptyScreenshot = path.join(artifactDir, 'cart_drawer_empty.png');
    await page.screenshot({ path: cartEmptyScreenshot, fullPage: false });
    console.log('Saved Cart Drawer Empty screenshot:', cartEmptyScreenshot);

    // Close empty cart drawer
    const closeBtn = page.locator('button[aria-label*="close" i]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // 5. CART DRAWER: ITEM-JUST-ADDED STATE
    console.log('Testing Cart Drawer: Item-Just-Added State...');
    await page.goto('http://localhost:5173/product/vb-long-sleeve-black', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await dismissCookies();

    // Select size and add to cart
    const sizeBtn = page.locator('button:has-text("M"), button:has-text("L")').first();
    if (await sizeBtn.count() > 0) {
      await sizeBtn.click();
      await page.waitForTimeout(200);
    }
    const atcBtn = page.locator('button:has-text("Shopping Bag")').first();
    if (await atcBtn.count() > 0) {
      await atcBtn.click();
      await page.waitForTimeout(800);
    }

    const cartJustAddedScreenshot = path.join(artifactDir, 'cart_drawer_just_added.png');
    await page.screenshot({ path: cartJustAddedScreenshot, fullPage: false });
    console.log('Saved Cart Drawer Just-Added screenshot:', cartJustAddedScreenshot);

    // 6. CART DRAWER: FILLED STATE
    console.log('Testing Cart Drawer: Filled State...');
    const viewFullBagLink = page.locator('button:has-text("View full bag")').first();
    if (await viewFullBagLink.isVisible()) {
      await viewFullBagLink.click();
      await page.waitForTimeout(400);
    }

    const cartFilledScreenshot = path.join(artifactDir, 'cart_drawer_filled.png');
    await page.screenshot({ path: cartFilledScreenshot, fullPage: false });
    console.log('Saved Cart Drawer Filled screenshot:', cartFilledScreenshot);

    await browser.close();
    console.log('All cart drawer screenshots completed successfully!');
  } catch (err) {
    console.error('Capture error:', err.message);
  }
}

main();
