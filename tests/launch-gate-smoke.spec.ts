import { test, expect } from '@playwright/test';

test.describe('Pre-Launch Countdown Gate & SNKRS Drop Strip Suite', () => {

  test('1. First Visit: displays full-screen countdown gate with logo, countdown, teaser, and waitlist form', async ({ page }) => {
    // Clear localStorage to ensure first visit
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Verify full-viewport dark gate
    const gate = page.locator('#launch-countdown-gate');
    await expect(gate).toBeVisible({ timeout: 10000 });

    // Verify VB Fits logo
    const logo = gate.locator('img[alt="VB FITS STUDIOS"]');
    await expect(logo).toBeVisible();

    // Verify countdown text labels
    await expect(gate.getByText('DAYS', { exact: true })).toBeVisible();
    await expect(gate.getByText('HOURS', { exact: true })).toBeVisible();
    await expect(gate.getByText('MIN', { exact: true })).toBeVisible();
    await expect(gate.getByText('SEC', { exact: true })).toBeVisible();

    // Verify teaser headline
    await expect(gate.locator('h2:has-text("ARCHIVAL VAULT")')).toBeVisible();

    // Verify Notify Me form
    const emailInput = gate.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Submit email to waitlist
    await emailInput.fill('vipcollector@vbfits.com');
    const submitBtn = gate.locator('button:has-text("NOTIFY ME ON DROP")');
    await submitBtn.click();

    // Verify confirmation message
    await expect(gate.getByText(/VIP Allocation Confirmed/i)).toBeVisible({ timeout: 5000 });
  });

  test('2. Admin QA Bypass: Logged-in admin sees Preview Site link and bypasses gate', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      // Set admin session
      localStorage.setItem('vbfits_admin_session_v1', JSON.stringify({
        id: 'adm-root-01',
        email: 'admin@vbfitsstudios.com',
        name: 'Store Admin',
        role: 'admin'
      }));
    });
    await page.reload();

    const gate = page.locator('#launch-countdown-gate');
    await expect(gate).toBeVisible({ timeout: 10000 });

    // Verify Preview Site (QA) button is visible for admin
    const previewBtn = gate.locator('button:has-text("Preview Site (QA)")');
    await expect(previewBtn).toBeVisible();

    // Click Preview Site
    await previewBtn.click();

    // Verify gate closes
    await expect(gate).not.toBeVisible();

    // Verify past_gate is set in localStorage
    const pastGateFlag = await page.evaluate(() => localStorage.getItem('past_gate'));
    expect(pastGateFlag).toBe('true');

    // Verify QA preview banner appears
    await expect(page.getByText('QA PREVIEW MODE')).toBeVisible();

    // Verify countdown strip is pinned above header
    const strip = page.locator('#launch-countdown-strip');
    await expect(strip).toBeVisible();
    await expect(strip.getByText('SNKRS DROP // VAULT')).toBeVisible();
  });

  test('3. Passed Launch: When launch_at is in the past, gate never renders and storefront is open', async ({ page }) => {
    // Intercept Supabase site_settings query so it returns a launch date in the past
    await page.route('**/rest/v1/site_settings*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'current',
          launch_at: '2020-01-01T00:00:00Z',
          countdown_gate_enabled: true,
          gate_enabled: true,
          teaser_headline: 'STORE OPEN',
          teaser_subtext: 'DROP IS LIVE',
          countdown_strip_enabled: true,
          countdown_strip_text: 'OFFICIAL DROP'
        })
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('vbfits_consent', 'accepted');
      // Simulate launch date in the past
      localStorage.setItem('vbfits_site_settings', JSON.stringify({
        id: 'current',
        launch_at: '2020-01-01T00:00:00Z',
        countdown_gate_enabled: true,
        gate_enabled: true,
        teaser_headline: 'STORE OPEN',
        teaser_subtext: 'DROP IS LIVE',
        countdown_strip_enabled: true,
        countdown_strip_text: 'OFFICIAL DROP'
      }));
    });
    await page.reload();

    // Gate should not render
    const gate = page.locator('#launch-countdown-gate');
    await expect(gate).not.toBeVisible();

    // Storefront navbar should be visible
    await expect(page.locator('header')).toBeVisible();
  });

  test('4. Admin Marketing: Launch Countdown tab edits launch_at, teaser headline/subtext, gate toggle & live preview card', async ({ page }) => {
    // Navigate with admin session and accepted cookie consent
    await page.goto('/admin/marketing');
    await page.evaluate(() => {
      localStorage.setItem('vbfits_consent', 'accepted');
      localStorage.setItem('vbfits_admin_session_v1', JSON.stringify({
        id: 'adm-root-01',
        email: 'admin@vbfitsstudios.com',
        name: 'Store Admin',
        role: 'admin'
      }));
    });
    await page.reload();

    // Click on the Launch Countdown tab
    const launchTabBtn = page.locator('button:has-text("Launch Countdown")');
    await expect(launchTabBtn).toBeVisible({ timeout: 10000 });
    await launchTabBtn.click();

    // Verify form fields
    const datetimeInput = page.locator('input[type="datetime-local"]');
    await expect(datetimeInput).toBeVisible();

    const headlineInput = page.locator('input[placeholder*="THE ARCHIVAL VAULT"]');
    await expect(headlineInput).toBeVisible();

    const subtextInput = page.locator('input[placeholder*="SECURE EARLY ATELIER"]');
    await expect(subtextInput).toBeVisible();

    // Verify Live Preview Card next to the form
    const previewHeader = page.getByText('LIVE PREVIEW');
    await expect(previewHeader).toBeVisible();

    // Edit headline and verify live preview card updates in real-time
    await headlineInput.fill('NOCTURNE RUNWAY DROP');
    await subtextInput.fill('EXCLUSIVE ATELIER RELEASE WORLDWIDE');

    await expect(page.locator('h4:has-text("NOCTURNE RUNWAY DROP")')).toBeVisible();
    await expect(page.locator('p:has-text("EXCLUSIVE ATELIER RELEASE WORLDWIDE")')).toBeVisible();

    // Save settings
    const saveBtn = page.locator('#save-launch-settings-btn');
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    // Verify confirmation toast
    await expect(page.getByText('تم الحفظ بنجاح وتحديث المتجر فوراً!')).toBeVisible({ timeout: 5000 });
  });
});

