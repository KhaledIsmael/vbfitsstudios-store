const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function verifyParity() {
  const browser = await chromium.launch({ headless: true });
  const outDir = path.join(__dirname, '../reference_audit/parity_verification');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const pagesToTest = [
    { name: 'home', url: 'http://localhost:5173/' },
    { name: 'shop', url: 'http://localhost:5173/shop' },
    { name: 'pdp', url: 'http://localhost:5173/product/vb-long-sleeve-black' }
  ];

  for (const p of pagesToTest) {
    // 1. Desktop (1440px)
    const deskContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const deskPage = await deskContext.newPage();
    await deskPage.goto(p.url, { waitUntil: 'networkidle' });
    await deskPage.waitForTimeout(1000);
    await deskPage.screenshot({ path: path.join(outDir, `${p.name}_desktop_full.png`), fullPage: true });

    // Also take viewport-only for home hero
    if (p.name === 'home') {
      await deskPage.screenshot({ path: path.join(outDir, 'home_desktop_hero.png') });
    }

    await deskContext.close();

    // 2. Mobile (390px)
    const mobContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobPage = await mobContext.newPage();
    await mobPage.goto(p.url, { waitUntil: 'networkidle' });
    await mobPage.waitForTimeout(1000);
    await mobPage.screenshot({ path: path.join(outDir, `${p.name}_mobile_full.png`), fullPage: true });
    await mobContext.close();
  }

  await browser.close();
  console.log('Parity screenshots saved successfully!');
}

verifyParity().catch(err => {
  console.error('Error during parity verification:', err);
  process.exit(1);
});
