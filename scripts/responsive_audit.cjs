const { chromium } = require('@playwright/test');
const path = require('path');

const BREAKPOINTS = [
  { name: 'Mobile Compact', width: 390, height: 844 },
  { name: 'Mobile Standard', width: 430, height: 932 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Desktop Standard', width: 1440, height: 900 },
  { name: 'Desktop Large', width: 1920, height: 1080 }
];

const PAGES_TO_TEST = [
  { name: 'Landing Page (Hero & Layout)', path: '/' },
  { name: 'Shop Page (Grid & Filters)', path: '/shop' },
  { name: 'Product Details Page', path: '/product/vb-long-sleeve-black' },
  { name: 'Checkout Page', path: '/checkout', setupCart: true }
];

async function runAudit() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome'
  }).catch(async () => {
    return await chromium.launch({ headless: true });
  });

  const report = [];

  for (const bp of BREAKPOINTS) {
    console.log(`\n========================================`);
    console.log(`Testing Breakpoint: ${bp.name} (${bp.width}x${bp.height})`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height }
    });
    const page = await context.newPage();

    for (const p of PAGES_TO_TEST) {
      if (p.setupCart) {
        await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' });
        await page.evaluate(() => {
          const item = {
            id: 'vb-signature-hoodie-001',
            name: 'VB Signature Archival Hoodie',
            price: 180,
            size: 'L',
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80'
          };
          localStorage.setItem('vbfits_cart', JSON.stringify([item]));
        });
      }

      await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        const hasOverflow = scrollWidth > clientWidth + 1; // 1px threshold for fractional pixels
        
        let offendingElements = [];
        if (hasOverflow) {
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 2) {
              offendingElements.push({
                tag: el.tagName,
                className: (el.className || '').toString().slice(0, 100),
                right: rect.right,
                width: rect.width
              });
              if (offendingElements.length >= 5) break;
            }
          }
        }
        return { hasOverflow, scrollWidth, clientWidth, offendingElements };
      });

      // Specific checks per page
      let pageSpecific = {};
      if (p.path === '/shop') {
        const gridCols = await page.evaluate(() => {
          const grid = document.querySelector('.grid.grid-cols-2, .grid.grid-cols-3, .grid.grid-cols-4');
          if (!grid) return null;
          const style = window.getComputedStyle(grid);
          return {
            gridTemplateColumns: style.gridTemplateColumns.split(' ').length,
            gap: style.gap
          };
        });
        pageSpecific.shopGrid = gridCols;
      }

      if (p.path.includes('/product/')) {
        const pdpLayout = await page.evaluate(() => {
          const mainGrid = document.querySelector('main .grid');
          if (!mainGrid) return null;
          const style = window.getComputedStyle(mainGrid);
          return {
            columns: style.gridTemplateColumns.split(' ').length
          };
        });
        pageSpecific.pdp = pdpLayout;
      }

      const result = {
        breakpoint: bp.name,
        width: bp.width,
        page: p.name,
        hasOverflow: overflow.hasOverflow,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
        offendingElements: overflow.offendingElements,
        details: pageSpecific
      };

      console.log(`[${bp.name} - ${bp.width}px] ${p.name}: Overflow=${overflow.hasOverflow ? 'FAIL (' + overflow.scrollWidth + 'px > ' + overflow.clientWidth + 'px)' : 'PASS'}`);
      if (pageSpecific.shopGrid) {
        console.log(`  Shop Grid Columns: ${pageSpecific.shopGrid.gridTemplateColumns} (Gap: ${pageSpecific.shopGrid.gap})`);
      }
      if (pageSpecific.pdp) {
        console.log(`  PDP Main Columns: ${pageSpecific.pdp.columns}`);
      }

      report.push(result);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAudit finished! Total checks:', report.length);
}

runAudit();
