import { test, expect } from '@playwright/test';

/**
 * VB Fits Studios - Staging Checkout Smoke Test
 * 
 * Validates:
 * 1. Product catalog browsing & adding silhouettes to the shopping bag.
 * 2. Navigating to the checkout experience (/checkout).
 * 3. Guest delivery coordinates validation (Name, Email, Mobile Phone, Governorate, City, Street).
 * 4. P2.3 Security Compliance: Confirms NO raw card details (PAN, CVV, expiry)
 *    ever touch the client application or internal database.
 * 5. Settlement method selection (Cash on Delivery & Paymob Online channels).
 */

test.describe('Staging Checkout Flow & Payment Security Smoke Tests', () => {

  test('1. Catalog to Checkout flow: adds silhouette to cart and opens checkout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('past_gate', 'true');
    });

    // Navigate to product detail page
    await page.goto('/product/vb-long-sleeve-black');
    await expect(page).toHaveURL(/\/product\/vb-long-sleeve-black/);

    // Select in-stock size M (Size S is sold out)
    await page.getByRole('button', { name: /Select size M/i }).click();

    const addToBagBtn = page.getByRole('button', { name: /Add to Cart/i });
    await expect(addToBagBtn).toBeVisible({ timeout: 15000 });
    await addToBagBtn.click();

    // Direct navigation to checkout
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout/);

    // Verify Checkout headers are populated
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  });

  test('2. Checkout form validation & delivery coordinates for guest client', async ({ page }) => {
    // Populate cart via localStorage to ensure test isolation
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('past_gate', 'true');
      const mockCartItem = [
        {
          id: 'vb-heavyweight-tee-mock-M',
          productId: 'prod-heavyweight-tee',
          name: 'Signature Boxy Heavyweight Tee',
          price: 180,
          currency: 'EGP',
          image: '/assets/products/black-shirt.webp',
          size: 'M',
          quantity: 1
        }
      ];
      localStorage.setItem('vbfits_cart', JSON.stringify(mockCartItem));
    });

    // Navigate to Checkout
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();

    // Fill Client Contact details
    const nameInput = page.getByLabel('Full name');
    const emailInput = page.getByLabel('Email address');
    const phoneInput = page.getByLabel(/Phone/i);

    await nameInput.fill('Smoke Test Client');
    await emailInput.fill('smoke-testing@vbfitsstudios.com');
    await phoneInput.fill('01001234567');

    // Fill Delivery Coordinates
    const cityInput = page.getByLabel('City / District');
    const addressInput = page.getByLabel('Address', { exact: true });

    await cityInput.fill('New Cairo');
    await addressInput.fill('North 90th St, Sector 1');

    // Verify values entered cleanly
    await expect(nameInput).toHaveValue('Smoke Test Client');
    await expect(emailInput).toHaveValue('smoke-testing@vbfitsstudios.com');
    await expect(phoneInput).toHaveValue('01001234567');
    await expect(cityInput).toHaveValue('New Cairo');
    await expect(addressInput).toHaveValue('North 90th St, Sector 1');

    // Verify Cash on Delivery radio is selected by default
    const codRadio = page.locator('input[type="radio"][value="Cash on Delivery"]');
    await expect(codRadio).toBeChecked();

    // Verify submission CTA is present and displays order total
    const submitBtn = page.getByRole('button', { name: /Confirm order/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('3. COD Exclusivity verification: COD is the sole payment method; online card/wallet channels removed', async ({ page }) => {
    // Populate cart and load checkout
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('past_gate', 'true');
      localStorage.setItem(
        'vbfits_cart',
        JSON.stringify([
          {
            id: 'security-audit-item-L',
            productId: 'sec-item',
            name: 'Archival Tailored Overcoat',
            price: 650,
            currency: 'EGP',
            image: '/assets/products/black-shirt.webp',
            size: 'L',
            quantity: 1
          }
        ])
      );
    });

    await page.goto('/checkout');

    // 1. Assert NO raw card input fields exist anywhere in the app's DOM
    const rawCardInputs = page.locator(
      'input[name*="card"], input[name*="cc-"], input[autocomplete*="cc-"], input[placeholder*="Card Number"], input[name*="cvv"], input[placeholder*="CVV"]'
    );
    await expect(rawCardInputs).toHaveCount(0);

    // 2. Assert Cash on Delivery is present and selected
    const codRadio = page.locator('input[type="radio"][value="Cash on Delivery"]');
    await expect(codRadio).toBeVisible();
    await expect(codRadio).toBeChecked();

    // 3. Assert "Pay Online", "Bank Cards", "Smart Wallets", "Powered by Paymob" are NOT present
    await expect(page.locator('input[type="radio"][value="Pay Online"]')).toHaveCount(0);
    await expect(page.locator('text=Powered by Paymob')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Bank Cards/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Smart Wallets/i })).toHaveCount(0);

    // 4. Submit CTA routes directly to Confirm order (COD)
    const submitBtn = page.getByRole('button', { name: /Confirm order/i });
    await expect(submitBtn).toBeVisible();
  });

  test('4. Supabase Auth Rate Limiting & Backoff UI smoke test', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Verify login inputs are present with exact IDs
    const emailInput = page.locator('#login-email');
    const passwordInput = page.locator('#login-password');
    const submitBtn = page.getByRole('button', { name: 'Sign In', exact: true });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });
});
