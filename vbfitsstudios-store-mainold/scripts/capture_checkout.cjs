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
      viewport: { width: 1440, height: 1100 }
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

    // Populate cart so checkout doesn't redirect to empty cart / shop
    await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const mockItem = {
        id: 'vb-signature-hoodie-001',
        name: 'VB Signature Archival Hoodie',
        price: 180,
        size: 'L',
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80'
      };
      localStorage.setItem('vbfits_cart', JSON.stringify([mockItem]));
    });

    console.log('Navigating to Checkout...');
    await page.goto('http://localhost:5173/checkout', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await dismissCookies();

    // Scroll to Settlement Method section
    const paymentSection = page.locator('section:has-text("Settlement Method")').first();
    await paymentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // 1. Screenshot: Default view with COD preselected and all 5 options visible in order
    const checkoutDefaultScreenshot = path.join(artifactDir, 'checkout_payment_selector_cod.png');
    await page.screenshot({ path: checkoutDefaultScreenshot, fullPage: false });
    console.log('Saved Checkout COD preselected screenshot:', checkoutDefaultScreenshot);

    // 2. Select Bank Cards
    const bankCardsRadio = page.locator('input[value="Bank Cards"]').first();
    await bankCardsRadio.click({ force: true });
    await page.waitForTimeout(400);
    const checkoutBankCardsScreenshot = path.join(artifactDir, 'checkout_payment_bank_cards.png');
    await page.screenshot({ path: checkoutBankCardsScreenshot, fullPage: false });
    console.log('Saved Checkout Bank Cards screenshot:', checkoutBankCardsScreenshot);

    // 3. Select Smart Wallets
    const smartWalletsRadio = page.locator('input[value="Smart Wallets"]').first();
    await smartWalletsRadio.click({ force: true });
    await page.waitForTimeout(400);
    const checkoutSmartWalletsScreenshot = path.join(artifactDir, 'checkout_payment_smart_wallets.png');
    await page.screenshot({ path: checkoutSmartWalletsScreenshot, fullPage: false });
    console.log('Saved Checkout Smart Wallets screenshot:', checkoutSmartWalletsScreenshot);

    // 4. Verify Apple Pay is disabled
    const applePayRadio = page.locator('input[value="Apple Pay"]').first();
    const isDisabled = await applePayRadio.isDisabled();
    console.log('Apple Pay radio isDisabled:', isDisabled);

    // 5. Mobile Viewport Screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await paymentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const checkoutMobileScreenshot = path.join(artifactDir, 'checkout_payment_mobile.png');
    await page.screenshot({ path: checkoutMobileScreenshot, fullPage: false });
    console.log('Saved Checkout Mobile screenshot:', checkoutMobileScreenshot);

    await browser.close();
    console.log('Checkout screenshots completed successfully!');
  } catch (err) {
    console.error('Capture error:', err.message);
  }
}

main();
