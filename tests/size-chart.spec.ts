import { test, expect } from '@playwright/test';

test.describe('Product Specific Size Chart Tests (Image-Only)', () => {
  test('opens size chart modal on PDP, displays image-only view without table option or toggle', async ({ page }) => {
    // Bypass countdown gate
    await page.addInitScript(() => {
      localStorage.setItem('past_gate', 'true');
    });

    // Navigate directly to a silhouette detail page
    await page.goto('/product/vb-long-sleeve-black');
    await expect(page).toHaveURL(/\/product\/vb-long-sleeve-black/);

    // Wait for loader to finish
    await expect(page.locator('text=Retrieving Archival Silhouette...')).toHaveCount(0, { timeout: 15000 });

    // Locate "Sizechart" button
    const sizeChartBtn = page.getByRole('button', { name: /Sizechart/i });
    await expect(sizeChartBtn).toBeVisible({ timeout: 15000 });
    await sizeChartBtn.click();

    // Verify modal is open
    const modal = page.locator('div[role="dialog"][aria-labelledby="size-chart-title"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=SIZE GUIDE')).toBeVisible();

    // Verify size chart image is displayed
    const chartImg = modal.locator('img[alt*="Size Guide"]');
    await expect(chartImg).toBeVisible();

    // Verify NO Visual/Table toggle buttons exist
    await expect(modal.getByRole('button', { name: /Table/i })).toHaveCount(0);
    await expect(modal.getByRole('button', { name: /Visual/i })).toHaveCount(0);

    // Verify NO measurement table element exists
    await expect(modal.locator('table')).toHaveCount(0);

    // Close modal via close button
    const closeBtn = modal.getByRole('button', { name: /Close size guide/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
