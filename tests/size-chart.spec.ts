import { test, expect } from '@playwright/test';

test.describe('Product Specific Size Chart Tests', () => {
  test('opens size chart modal on PDP and supports visual & table views', async ({ page }) => {
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

    // Verify visual diagram with template image is present
    const templateImg = modal.locator('img[alt*="Technical Size Chart"]');
    await expect(templateImg).toBeVisible();

    // Switch to table view
    const tableBtn = modal.getByRole('button', { name: /Table/i });
    if (await tableBtn.isVisible()) {
      await tableBtn.click();
      // Verify table headers (Size, Length, Width, Sleeve length)
      await expect(modal.locator('table')).toBeVisible();
      await expect(modal.getByRole('columnheader', { name: 'Size' })).toBeVisible();
      await expect(modal.getByRole('columnheader', { name: 'Length (cm)', exact: true })).toBeVisible();
      await expect(modal.getByRole('columnheader', { name: 'Width (cm)' })).toBeVisible();
      await expect(modal.getByRole('columnheader', { name: 'Sleeve length (cm)' })).toBeVisible();
    }

    // Close modal
    const closeBtn = modal.getByRole('button', { name: /Close size guide/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
