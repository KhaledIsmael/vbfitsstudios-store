const { chromium } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/product/vb-long-sleeve-black', { waitUntil: 'networkidle' });

  const data = await page.evaluate(() => {
    const gallery = document.querySelector('[aria-label*="gallery"]');
    if (!gallery) return 'no gallery';
    const imgs = Array.from(gallery.querySelectorAll('img'));
    return imgs.map(img => ({
      src: img.src,
      rect: img.getBoundingClientRect(),
      parentRect: img.parentElement?.getBoundingClientRect(),
      parentClass: img.parentElement?.className,
      grandParentClass: img.parentElement?.parentElement?.className,
      grandParentRect: img.parentElement?.parentElement?.getBoundingClientRect()
    }));
  });

  console.log('GALLERY DATA:', JSON.stringify(data, null, 2));
  await browser.close();
}

main();
