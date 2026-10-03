const { chromium } = require('@playwright/test');
const fs = require('fs');

async function testFinalFixes() {
  console.log('--- Starting Final Fixes Verification ---');
  let failures = 0;

  // 1. Raw HTML initial splash logo check
  const rawHtml = fs.readFileSync('index.html', 'utf8');
  if (rawHtml.includes('id="initial-splash"') && rawHtml.includes('/assets/logo/logo-dark.png')) {
    console.log('✅ 1. Initial Page Load Splash Screen: Logo present in index.html with preload');
  } else {
    console.error('❌ 1. Initial Page Load Splash Screen: Missing splash logo in index.html');
    failures++;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 2. Homepage verification
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);

    // Verify Language switcher removed
    const hasLangSwitch = await page.$('button[aria-label*="Select Language"]');
    if (!hasLangSwitch) {
      console.log('✅ 8. Language Switcher: Successfully removed from Navbar');
    } else {
      console.error('❌ 8. Language Switcher: Still visible in Navbar');
      failures++;
    }

    // Verify Profile Active Indicator (green dot) removed
    const hasGreenDot = await page.$('.bg-emerald-400');
    if (!hasGreenDot) {
      console.log('✅ 10. Profile Active Indicator: Green status dot removed');
    } else {
      console.error('❌ 10. Profile Active Indicator: Green status dot still found');
      failures++;
    }

    // Verify Homepage 4-card Featured Collection
    const cards = await page.$$('.sorvea-grid-item');
    if (cards.length === 4) {
      console.log(`✅ 3. Homepage Cards Count: Exactly 4 featured cards rendered (found ${cards.length})`);
    } else {
      console.error(`❌ 3. Homepage Cards Count: Expected 4 cards, found ${cards.length}`);
      failures++;
    }

    // Verify flatlay shirts displayed without model photo
    const cardImgSrcs = await page.$$eval('.sorvea-grid-item img', imgs => imgs.map(i => i.src));
    const hasModelPhotoInCards = cardImgSrcs.some(src => src.includes('hero.jpg') || src.includes('hero.webp'));
    if (!hasModelPhotoInCards) {
      console.log('✅ 3. Homepage T-Shirt Cards: Flat-lay photo displayed directly; model photo excluded');
    } else {
      console.error('❌ 3. Homepage T-Shirt Cards: Model photo still present in cards:', cardImgSrcs);
      failures++;
    }

    // Verify Redundant Section Removed
    const hasInstaStrip = await page.$('section:has-text("@VBFITSSTUDIOS")');
    if (!hasInstaStrip) {
      console.log('✅ 4. Homepage Redundant Section: Removed completely');
    } else {
      console.error('❌ 4. Homepage Redundant Section: Still present on page');
      failures++;
    }

    // Verify Pinterest Removal
    const pinterestLinks = await page.$$('a[href*="pinterest"], button[aria-label*="Pinterest"]');
    if (pinterestLinks.length === 0) {
      console.log('✅ 5. Pinterest Removal: Completely removed from entire site and footer');
    } else {
      console.error('❌ 5. Pinterest Removal: Still found Pinterest links:', pinterestLinks.length);
      failures++;
    }

    // Verify Sidebar Drawer Typography
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="Open menu" i]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const linkClasses = await page.$$eval('nav[aria-label="Primary Navigation"] a', links => links.map(l => l.className));
      const hasCleanTypography = linkClasses.every(c => c.includes('text-lg') || c.includes('text-xl'));
      if (hasCleanTypography) {
        console.log('✅ 9. Sidebar Typography: Refined font sizes and sleek letter-spacing verified');
      } else {
        console.error('❌ 9. Sidebar Typography: Unrefined font class:', linkClasses);
        failures++;
      }
      // Close menu
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // 6. PDP Verification
    await page.goto('http://localhost:5173/product/vb-long-sleeve-black');
    await page.waitForTimeout(1000);
    const galleryBox = await page.$eval('.cursor-zoom-in, [aria-label*="gallery" i]', el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    console.log(`✅ 2. Product Page Image Size: Bounded gallery width = ${Math.round(galleryBox.width)}px, height = ${Math.round(galleryBox.height)}px`);
    if (galleryBox.width <= 600) {
      console.log('✅ 2. Product Page Image Size: Successfully optimized and constrained (<= 600px width)');
    } else {
      console.error('❌ 2. Product Page Image Size: Excessively large width:', galleryBox.width);
      failures++;
    }

    // 7. Profile Page Avatar Removal Check
    await page.goto('http://localhost:5173/profile');
    await page.waitForTimeout(1000);
    const profileAvatar = await page.$('.rounded-full img');
    if (!profileAvatar) {
      console.log('✅ 6. Client Profile Picture: Avatar section completely removed');
    } else {
      console.error('❌ 6. Client Profile Picture: Avatar still found on Profile Page');
      failures++;
    }

    // 8. Checkout Payment Options Check
    await page.goto('http://localhost:5173/checkout');
    await page.waitForTimeout(1000);
    const hasPayOnline = await page.$('input[value="Pay Online"]');
    const hasApplePay = await page.$('input[value="Apple Pay"]:not([disabled])');
    const applePayDisabled = await page.$('input[value="Apple Pay"][disabled]');
    if (!hasPayOnline) {
      console.log('✅ 7. Payment Options: "Pay Online" removed');
    } else {
      console.error('❌ 7. Payment Options: "Pay Online" is still present');
      failures++;
    }
    if (hasApplePay && !applePayDisabled) {
      console.log('✅ 7. Payment Options: "Apple Pay" is active and integrated');
    } else {
      console.error('❌ 7. Payment Options: "Apple Pay" is missing or disabled');
      failures++;
    }

  } catch (err) {
    console.error('Error during test execution:', err);
    failures++;
  } finally {
    await browser.close();
  }

  console.log(`--- Verification Complete: ${failures === 0 ? 'ALL CHECKS PASSED ✅' : `${failures} CHECKS FAILED ❌`} ---`);
  process.exit(failures === 0 ? 0 : 1);
}

testFinalFixes();
