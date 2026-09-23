const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function scrapeReference() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating to https://sorveaclo.com/en ...');
  try {
    await page.goto('https://sorveaclo.com/en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (err) {
    console.error('Goto error:', err.message);
  }

  // 1. Take desktop screenshot
  const outDir = path.join(__dirname, '../reference_audit');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await page.screenshot({ path: path.join(outDir, 'sorvea_desktop_full.png'), fullPage: true });

  // 2. Extract DOM sections & structure
  const structure = await page.evaluate(() => {
    // Helper to get computed styles
    function getStyles(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        padding: cs.padding,
        margin: cs.margin,
        border: cs.border,
        textTransform: cs.textTransform
      };
    }

    // Header
    const announcement = document.querySelector('.announcement-bar, [class*="announcement"]');
    const header = document.querySelector('header, .header, [class*="header"]');
    const nav = document.querySelector('nav, [class*="nav"]');

    // Sections
    const sections = Array.from(document.querySelectorAll('main > section, main > div, #MainContent > *')).map(sec => ({
      tagName: sec.tagName,
      id: sec.id,
      className: sec.className,
      textSnippet: sec.innerText ? sec.innerText.slice(0, 100).replace(/\n/g, ' ') : ''
    }));

    // Find links to collections and products
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.getAttribute('href'), text: a.innerText.trim() }))
      .filter(l => l.href && (l.href.includes('/products/') || l.href.includes('/collections/')));

    // Header details
    const headerDetails = {
      html: header ? header.outerHTML.slice(0, 1000) : '',
      styles: getStyles(header),
      logo: header?.querySelector('img, svg, .logo, [class*="logo"]')?.outerHTML?.slice(0, 300)
    };

    // Announcement bar details
    const announcementDetails = {
      text: announcement ? announcement.innerText.trim() : '',
      styles: getStyles(announcement)
    };

    // Footer details
    const footer = document.querySelector('footer, .footer, [class*="footer"]');
    const footerDetails = {
      text: footer ? footer.innerText.slice(0, 500) : '',
      styles: getStyles(footer)
    };

    return {
      title: document.title,
      announcementDetails,
      headerDetails,
      sections,
      links: links.slice(0, 15),
      footerDetails
    };
  });

  fs.writeFileSync(path.join(outDir, 'sorvea_structure.json'), JSON.stringify(structure, null, 2));
  console.log('Saved sorvea_structure.json and sorvea_desktop_full.png');

  // Let's also inspect mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'sorvea_mobile_full.png'), fullPage: true });

  // Let's see if we can click the menu drawer or cart drawer
  const menuBtn = await page.$('button[aria-label*="menu" i], [class*="menu-toggle"], [class*="drawer-toggle"], [aria-controls*="menu" i], .header__icon--menu, summary[aria-label*="Menu"]');
  if (menuBtn) {
    try {
      await menuBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, 'sorvea_mobile_menu.png') });
    } catch (e) {
      console.log('Could not open menu drawer:', e.message);
    }
  }

  // Visit a product page if found
  if (structure.links.some(l => l.href.includes('/products/'))) {
    const prodLink = structure.links.find(l => l.href.includes('/products/')).href;
    const prodUrl = prodLink.startsWith('http') ? prodLink : `https://sorveaclo.com${prodLink}`;
    console.log('Navigating to product:', prodUrl);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(prodUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'sorvea_pdp_desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'sorvea_pdp_mobile.png'), fullPage: true });
  }

  await browser.close();
  console.log('Done scraping reference!');
}

scrapeReference().catch(err => {
  console.error('Fatal scrape error:', err);
  process.exit(1);
});
