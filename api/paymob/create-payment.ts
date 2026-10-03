import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/paymob/create-payment
 *
 * Body: {
 *   orderId: string;         // Our internal Supabase order UUID
 *   orderNumber: string;     // VBF-XXXXX reference
 *   amountCents: number;     // Total in *cents* (EGP × 100)
 *   currency: string;        // 'EGP'
 *   billingData: {
 *     firstName: string;
 *     lastName: string;
 *     email: string;
 *     phone: string;
 *     city: string;
 *     country: string;
 *     street: string;
 *     building?: string;
 *     floor?: string;
 *     apartment?: string;
 *   }
 * }
 *
 * Returns: { redirectUrl: string } on success
 *          { error: string }       on failure
 */
// ─────────────────────────────────────────────────────────────
// Rate Limiter: Mitigate automated card testing & API abuse
// ─────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PAYMENT_ATTEMPTS = 10; // 10 attempts per 10 minutes per IP

interface RateRecord {
  count: number;
  resetTime: number;
}

const ipRateLimits = new Map<string, RateRecord>();

function checkRateLimit(ip: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();

  // Garbage collect stale records if cache grows
  if (ipRateLimits.size > 2000) {
    for (const [key, record] of ipRateLimits.entries()) {
      if (now > record.resetTime) {
        ipRateLimits.delete(key);
      }
    }
  }

  const existing = ipRateLimits.get(ip);
  if (!existing || now > existing.resetTime) {
    ipRateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }

  if (existing.count >= MAX_PAYMENT_ATTEMPTS) {
    const retryAfter = Math.ceil((existing.resetTime - now) / 1000);
    return { limited: true, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  existing.count += 1;
  return { limited: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Client IP Rate Limit Check ---
  const rawIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket?.remoteAddress ||
    'client-ip-fallback';

  const rateResult = checkRateLimit(rawIp);
  if (rateResult.limited) {
    res.setHeader('Retry-After', String(rateResult.retryAfterSeconds || 60));
    return res.status(429).json({
      error: 'Excessive payment requests detected. For your security, please wait before retrying.',
      retryAfter: rateResult.retryAfterSeconds
    });
  }

  const apiKey = process.env.PAYMOB_API_KEY;
  const defaultIntegrationId = process.env.PAYMOB_INTEGRATION_ID;

  if (!apiKey || !defaultIntegrationId) {
    console.error('Missing Paymob credentials. Set PAYMOB_API_KEY and PAYMOB_INTEGRATION_ID.');
    return res.status(500).json({ error: 'Payment gateway not configured.' });
  }

  const {
    orderId,
    orderNumber,
    amountCents,
    currency = 'EGP',
    billingData,
    paymentChannel = 'card', // 'card' | 'wallet' | 'valu' | 'sympl'
    walletPhone
  } = req.body || {};

  // Resolve integration ID per channel with fallback to default
  let selectedIntegrationId = defaultIntegrationId;
  if (paymentChannel === 'card' && process.env.PAYMOB_INTEGRATION_ID_CARD) {
    selectedIntegrationId = process.env.PAYMOB_INTEGRATION_ID_CARD;
  } else if (paymentChannel === 'wallet' && process.env.PAYMOB_INTEGRATION_ID_WALLET) {
    selectedIntegrationId = process.env.PAYMOB_INTEGRATION_ID_WALLET;
  } else if (paymentChannel === 'valu' && process.env.PAYMOB_INTEGRATION_ID_VALU) {
    selectedIntegrationId = process.env.PAYMOB_INTEGRATION_ID_VALU;
  } else if (paymentChannel === 'sympl' && process.env.PAYMOB_INTEGRATION_ID_SYMPL) {
    selectedIntegrationId = process.env.PAYMOB_INTEGRATION_ID_SYMPL;
  }

  // --- Input validation ---
  if (!orderId || !orderNumber || !amountCents || !billingData) {
    return res.status(400).json({ error: 'Missing required payment parameters.' });
  }

  if (typeof amountCents !== 'number' || amountCents < 100) {
    return res.status(400).json({ error: 'Invalid amount. Must be at least 100 cents (1 EGP).' });
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // Paymob v3 Unified Checkout — Single-call "Intention" approach
    // Docs: https://developers.paymob.com/egypt/docs/accept-api-v3-unified-checkout
    // ─────────────────────────────────────────────────────────────

    // For wallet transactions, use walletPhone if provided, otherwise fallback to billing phone
    const finalPhone = (paymentChannel === 'wallet' && walletPhone)
      ? walletPhone
      : billingData.phone || '+20000000000';

    const intentionPayload: any = {
      amount: amountCents,
      currency,
      payment_methods: [parseInt(selectedIntegrationId, 10)],
      items: [
        {
          name: `VB Fits Studios Order ${orderNumber}`,
          amount: amountCents,
          description: `Order ${orderNumber} (${paymentChannel.toUpperCase()})`,
          quantity: 1
        }
      ],
      billing_data: {
        apartment: billingData.apartment || 'NA',
        first_name: billingData.firstName || 'Guest',
        last_name: billingData.lastName || 'Client',
        street: billingData.street || 'NA',
        building: billingData.building || 'NA',
        phone_number: finalPhone,
        city: billingData.city || 'Cairo',
        country: billingData.country || 'EG',
        email: billingData.email || 'guest@vbfits.com',
        floor: billingData.floor || 'NA',
        state: billingData.governorate || billingData.city || 'Cairo'
      },
      customer: {
        first_name: billingData.firstName || 'Guest',
        last_name: billingData.lastName || 'Client',
        email: billingData.email || 'guest@vbfits.com'
      },
      extras: {
        payment_channel: paymentChannel,
        order_uuid: orderId
      },
      // Merchant order ID links Paymob's internal ID back to our order
      merchant_order_id: orderNumber,
      // Redirect URLs after hosted payment page completes
      redirection_url: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/payment-callback?order_id=${orderId}&order_number=${orderNumber}`
    };

    const intentionRes = await fetch('https://accept.paymob.com/v3/intention/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`
      },
      body: JSON.stringify(intentionPayload)
    });

    if (!intentionRes.ok) {
      const errorBody = await intentionRes.text();
      console.error('Paymob intention error:', intentionRes.status, errorBody);
      return res.status(502).json({
        error: `Payment gateway returned ${intentionRes.status}. Please try again.`
      });
    }

    const intentionData = await intentionRes.json();

    // v3 returns a client_secret used to build the hosted payment URL
    const clientSecret = intentionData?.client_secret;
    if (!clientSecret) {
      console.error('No client_secret in Paymob response:', intentionData);
      return res.status(502).json({ error: 'Unexpected payment gateway response.' });
    }

    // Build the Paymob hosted checkout URL
    const redirectUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${apiKey}&clientSecret=${clientSecret}`;

    return res.status(200).json({ redirectUrl });
  } catch (err: any) {
    console.error('create-payment exception:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error.' });
  }
}
