import { test, expect } from '@playwright/test';

/**
 * Footer social icons: WhatsApp removed; Instagram and TikTok remain.
 */
for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`Footer shows Instagram + TikTok and no WhatsApp (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/shop');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible({ timeout: 15000 });

    // Icon row
    await expect(footer.locator('a[aria-label="Instagram"]')).toHaveCount(1);
    await expect(footer.locator('a[aria-label="TikTok"]')).toHaveCount(1);
    await expect(footer.locator('a[aria-label="WhatsApp"]')).toHaveCount(0);

    // Links point somewhere real
    await expect(footer.locator('a[aria-label="Instagram"]')).toHaveAttribute('href', /instagram\.com/i);
    await expect(footer.locator('a[aria-label="TikTok"]')).toHaveAttribute('href', /tiktok\.com/i);

    // No WhatsApp link anywhere in the footer (text column or icon row)
    await expect(footer.locator('a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
    await expect(footer.getByText(/whatsapp/i)).toHaveCount(0);

    await footer.screenshot({ path: `test-results/footer-${vp.name}.png` });
  });
}
