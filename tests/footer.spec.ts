import { test, expect } from '@playwright/test';

/**
 * Social links verification: WhatsApp removed; Instagram and TikTok remain.
 * Verified across Footer, Sidebar (MenuDrawer), and Contact Us Page.
 */
for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`Social links verification (${vp.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.setItem('past_gate', 'true');
      });
    });

    test(`Footer shows Instagram + TikTok and no WhatsApp`, async ({ page }) => {
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
    });

    test(`Sidebar (MenuDrawer) shows Instagram + TikTok and no WhatsApp`, async ({ page }) => {
      await page.goto('/shop');

      // Open navigation menu drawer
      const menuBtn = page.getByRole('button', { name: /Open Navigation Menu/i });
      await expect(menuBtn).toBeVisible({ timeout: 15000 });
      await menuBtn.click();

      // Drawer panel
      const drawer = page.locator('div[role="dialog"][aria-label="Navigation Menu"]');
      await expect(drawer).toBeVisible();

      // Socials section in drawer
      const socialsSection = drawer.locator('div:has(> p:text-is("Socials"))');
      await expect(socialsSection).toBeVisible();

      // Check Instagram & TikTok exist
      await expect(socialsSection.getByRole('link', { name: /Instagram/i })).toBeVisible();
      await expect(socialsSection.getByRole('link', { name: /TikTok/i })).toBeVisible();

      // Verify WhatsApp does NOT exist in sidebar
      await expect(socialsSection.getByRole('link', { name: /WhatsApp/i })).toHaveCount(0);
      await expect(drawer.locator('a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
      await expect(drawer.getByText(/whatsapp/i)).toHaveCount(0);
    });

    test(`Contact Us page shows Instagram + TikTok and no WhatsApp`, async ({ page }) => {
      await page.goto('/contact');
      await expect(page).toHaveURL(/\/contact/);

      // Locate Socials section within Contact page content (avoid footer collision)
      const socialsContainer = page.locator('div:has(> h3:text-is("Socials"))');
      await expect(socialsContainer).toBeVisible({ timeout: 15000 });

      // Check Instagram & TikTok exist
      await expect(socialsContainer.getByRole('link', { name: 'Instagram' })).toBeVisible();
      await expect(socialsContainer.getByRole('link', { name: 'TikTok' })).toBeVisible();

      // Verify WhatsApp does NOT exist in Contact Us Socials
      await expect(socialsContainer.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
      await expect(socialsContainer.locator('a[href*="wa.me"], a[href*="whatsapp"]')).toHaveCount(0);
      await expect(socialsContainer.getByText(/whatsapp/i)).toHaveCount(0);
    });
  });
}
