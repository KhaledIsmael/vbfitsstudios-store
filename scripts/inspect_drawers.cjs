const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function inspectHeaderAndDrawers() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto('https://sorveaclo.com/en', { waitUntil: 'networkidle', timeout: 30000 });

  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header, .header, [id*="header"], [class*="header"]');
    const allButtons = Array.from(document.querySelectorAll('header button, header a, .header-wrapper *')).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      ariaLabel: el.getAttribute('aria-label'),
      text: el.innerText.trim(),
      role: el.getAttribute('role'),
      href: el.getAttribute('href')
    }));
    return {
      headerHtml: header ? header.outerHTML : 'none',
      allButtons
    };
  });

  console.log('Header buttons/links:', JSON.stringify(headerInfo.allButtons, null, 2));

  // Let's click the first button or element in header that might be menu
  // On desktop or mobile, let's find the menu trigger
  const outDir = path.join(__dirname, '../reference_audit');

  // Try finding drawer triggers
  const triggers = await page.$$('header button, header summary, header .header__icon, [data-action="open-drawer"]');
  console.log(`Found ${triggers.length} triggers in header`);

  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    const text = await t.evaluate(el => el.getAttribute('aria-label') || el.innerText || el.className);
    console.log(`Trigger ${i}:`, text);
  }

  // Let's test clicking the cart icon or menu icon
  const cartTrigger = await page.$('a[href*="/cart"], [class*="cart"], button[aria-label*="cart" i], [id*="cart-icon"]');
  if (cartTrigger) {
    console.log('Clicking cart trigger...');
    await cartTrigger.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'sorvea_cart_drawer.png') });
  }

  // Reload and try menu trigger on mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://sorveaclo.com/en', { waitUntil: 'networkidle' });

  // On mobile, let's find whatever is at top-left (e.g. click at coordinate x=25, y=30)
  console.log('Clicking top-left for menu drawer...');
  await page.mouse.click(25, 30);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'sorvea_menu_drawer_clicked.png') });

  // Let's also check if top-right cart clicked
  console.log('Clicking top-right for cart drawer...');
  await page.mouse.click(365, 30);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'sorvea_cart_drawer_mobile.png') });

  await browser.close();
}

inspectHeaderAndDrawers().catch(console.error);
