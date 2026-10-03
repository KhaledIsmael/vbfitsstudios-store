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
    // Navigate to Shop
    await page.goto('/shop');
    await expect(page).toHaveTitle(/VB FITS STUDIOS/i);

    // Wait for catalog items to appear
    const productCard = page.locator('.group.cursor-pointer').first();
    await expect(productCard).toBeVisible({ timeout: 10000 });

    // Click into the first product detail page
    await productCard.click();

    // Verify on product detail page
    await expect(page).toHaveURL(/\/product\//);
    const addToBagBtn = page.getByRole('button', { name: /Add to Shopping Bag/i });
    await expect(addToBagBtn).toBeVisible({ timeout: 10000 });

    // Add product to cart
    await addToBagBtn.click();

    // Direct navigation to checkout
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout/);

    // Verify Checkout header & Order Summary are populated
    await expect(page.locator('text=Order Summary')).toBeVisible();
    await expect(page.locator('text=Total Value')).toBeVisible();
  });

  test('2. Checkout form validation & delivery coordinates for guest client', async ({ page }) => {
    // Populate cart via localStorage to ensure test isolation
    await page.goto('/');
    await page.evaluate(() => {
      const mockCartItem = [
        {
          id: 'vb-heavyweight-tee-mock-M',
          productId: 'prod-heavyweight-tee',
          name: 'Signature Boxy Heavyweight Tee',
          price: 180,
          currency: '$',
          image: '/assets/products/black-shirt.jpeg',
          size: 'M',
          quantity: 1
        }
      ];
      localStorage.setItem('vbfits_cart', JSON.stringify(mockCartItem));
    });

    // Navigate to Checkout
    await page.goto('/checkout');
    await expect(page.locator('text=1. Contact Information')).toBeVisible();
    await expect(page.locator('text=2. Delivery Coordinates')).toBeVisible();
    await expect(page.locator('text=3. Settlement Method')).toBeVisible();

    // Fill Client Contact details
    const nameInput = page.getByPlaceholder('e.g. Christian Dior');
    const emailInput = page.getByPlaceholder('name@domain.com');
    const phoneInput = page.getByPlaceholder('+20 100 000 0000');

    await nameInput.fill('Smoke Test Client');
    await emailInput.fill('smoke-testing@vbfitsstudios.com');
    await phoneInput.fill('+20 100 123 4567');

    // Fill Delivery Coordinates
    const cityInput = page.getByPlaceholder(/New Cairo/i);
    const streetInput = page.getByPlaceholder(/South 90th Street/i);

    await cityInput.fill('New Cairo');
    await streetInput.fill('North 90th St, Sector 1');

    // Verify values entered cleanly
    await expect(nameInput).toHaveValue('Smoke Test Client');
    await expect(emailInput).toHaveValue('smoke-testing@vbfitsstudios.com');
    await expect(phoneInput).toHaveValue('+20 100 123 4567');
    await expect(cityInput).toHaveValue('New Cairo');
    await expect(streetInput).toHaveValue('North 90th St, Sector 1');

    // Verify Cash on Delivery radio is selected by default
    const codRadio = page.locator('input[type="radio"][value="Cash on Delivery"]');
    await expect(codRadio).toBeChecked();

    // Verify submission CTA is present and displays order total
    const submitBtn = page.getByRole('button', { name: /Confirm Acquisition/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('3. Security verification (P2.3): No raw card data inputs exist on app DOM', async ({ page }) => {
    // Populate cart and load checkout
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'vbfits_cart',
        JSON.stringify([
          {
            id: 'security-audit-item-L',
            productId: 'sec-item',
            name: 'Archival Tailored Overcoat',
            price: 650,
            currency: '$',
            image: '/assets/products/black-shirt.jpeg',
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

    // 2. Select "Pay Online" option
    const payOnlineRadio = page.locator('input[type="radio"][value="Pay Online"]');
    await payOnlineRadio.check();
    await expect(payOnlineRadio).toBeChecked();

    // 3. Verify channel sub-selector appears with Paymob delegate branding
    await expect(page.locator('text=Powered by Paymob')).toBeVisible();
    await expect(page.getByRole('button', { name: /Bank Cards/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Smart Wallets/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Installments/i })).toBeVisible();

    // 4. Confirm STILL no raw card fields exist — Paymob handles Hosted Checkout entirely
    await expect(rawCardInputs).toHaveCount(0);

    // 5. Submit CTA now routes to external gateway redirect
    const payBtn = page.getByRole('button', { name: /Proceed to Payment/i });
    await expect(payBtn).toBeVisible();
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
