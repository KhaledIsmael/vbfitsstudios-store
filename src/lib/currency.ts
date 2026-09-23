/**
 * Currency Formatting Utilities
 * Default storefront currency: EGP (Egyptian Pounds)
 */

export const STORE_CURRENCY = 'EGP';

/**
 * Formats a monetary amount into a clean currency string.
 * Example: formatPrice(1250) => "1,250.00 EGP"
 */
export function formatPrice(amount: number | string | null | undefined, currency: string = STORE_CURRENCY): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

/**
 * Formats a monetary amount without decimals if clean integer, or with 2 decimals.
 * Example: formatPriceCompact(1250) => "1,250 EGP"
 */
export function formatPriceCompact(amount: number | string | null | undefined, currency: string = STORE_CURRENCY): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const hasDecimals = num % 1 !== 0;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })} ${currency}`;
}
