import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/cron/abandoned-carts
 *
 * Scheduled Vercel Function (runs hourly via vercel.json cron).
 * Finds shopping carts from P1.1 (public.cart_items) last updated 2+ hours ago
 * with no matching completed order and a known customer email, and triggers
 * a Brevo transactional "You left something behind" recovery email with items
 * and a direct link back to checkout.
 */

interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  size: string;
  price: number;
  currency: string;
  image: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  abandoned_email_sent_at?: string | null;
}

interface CustomerRow {
  id: string;
  email: string;
  full_name?: string | null;
}

function buildAbandonedCartEmailHtml(data: {
  customerName: string;
  items: CartItemRow[];
  subtotal: number;
  currency: string;
  checkoutUrl: string;
  appUrl: string;
}): string {
  const { customerName, items, subtotal, currency, checkoutUrl, appUrl } = data;

  const itemRowsHtml = items
    .map((item) => {
      const imgUrl = item.image.startsWith('http')
        ? item.image
        : `${appUrl}${item.image.startsWith('/') ? '' : '/'}${item.image}`;

      return `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA; width: 70px; vertical-align: top;">
          <img src="${imgUrl}" alt="${item.name}" width="60" height="75" style="display: block; object-fit: cover; background: #F5F5F5; border: 1px solid #EAEAEA;" />
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #EAEAEA; vertical-align: top;">
          <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; color: #111111; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px 0;">
            ${item.name}
          </p>
          <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #777777; text-transform: uppercase; letter-spacing: 0.06em; margin: 0;">
            Size: ${item.size} &nbsp;·&nbsp; Qty: ${item.quantity}
          </p>
        </td>
        <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA; text-align: right; vertical-align: top;">
          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; color: #111111;">
            ${(item.price * item.quantity).toFixed(2)} ${currency}
          </span>
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You left something behind · VB Fits Studios</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #FAFAFA; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #EAEAEA; box-shadow: 0 4px 24px rgba(0,0,0,0.03);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #F0F0F0;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 400; letter-spacing: 0.35em; text-transform: uppercase; color: #111111;">
                VB FITS STUDIOS
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 9px; color: #888888; letter-spacing: 0.2em; text-transform: uppercase;">
                Atelier · Cairo & Giza
              </p>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="padding: 36px 40px 20px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 0.15em;">
                Shopping Bag Notice
              </p>
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 300; text-transform: uppercase; letter-spacing: 0.08em; color: #111111; line-height: 1.3;">
                You Left Something Behind
              </h2>
              <p style="margin: 0 auto; font-size: 13px; color: #555555; line-height: 1.6; max-width: 440px;">
                Dear ${customerName}, your selected archival pieces remain reserved in your bag. Due to limited production runs, stock allocations cannot be held indefinitely.
              </p>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 10px 40px 20px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${itemRowsHtml}
                <tr>
                  <td colspan="2" style="padding: 16px 0 0 0; text-align: left;">
                    <span style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 0.1em;">
                      Estimated Subtotal
                    </span>
                  </td>
                  <td style="padding: 16px 0 0 0; text-align: right;">
                    <span style="font-size: 14px; font-weight: 600; color: #111111;">
                      ${subtotal.toFixed(2)} ${currency}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Direct CTA -->
          <tr>
            <td style="padding: 24px 40px 36px 40px; text-align: center;">
              <a href="${checkoutUrl}" style="background-color: #111111; color: #FFFFFF; display: inline-block; padding: 16px 36px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em; text-decoration: none; border-radius: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
                Complete Your Order &rarr;
              </a>
              <p style="margin: 16px 0 0 0; font-size: 10px; color: #888888; letter-spacing: 0.05em;">
                Quick checkout · Instant order confirmation
              </p>
            </td>
          </tr>

          <!-- Trust Assurances -->
          <tr>
            <td style="padding: 24px 40px; background-color: #FAFAFA; border-top: 1px solid #EAEAEA; border-bottom: 1px solid #EAEAEA;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="font-size: 9px; color: #666666; text-transform: uppercase; letter-spacing: 0.12em; line-height: 1.8;">
                    Complimentary Express Shipping over $250 &nbsp;·&nbsp; 14-Day Returns &nbsp;·&nbsp; Encrypted Checkout
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #111111; font-weight: 500; letter-spacing: 0.05em;">
                Need assistance with sizing or styling?
              </p>
              <p style="margin: 0 0 16px 0; font-size: 10px; color: #888888;">
                Our concierge team is at your service at <a href="mailto:concierge@vbfitsstudios.com" style="color: #111111; text-decoration: underline;">concierge@vbfitsstudios.com</a>
              </p>
              <p style="margin: 0; font-size: 9px; color: #AAAAAA; text-transform: uppercase; letter-spacing: 0.1em;">
                &copy; 2026 VB FITS STUDIOS · All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET (Vercel Cron standard) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security: Check Vercel Cron Secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron request.' });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase configuration missing.' });
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'orders@vbfitsstudios.com';
  const appUrl = process.env.VITE_APP_URL || 'https://vbfitsstudios.com';

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Time cutoffs:
  // 1. Abandoned if last updated >= 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // 2. Do not email ancient carts older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // 3. Skip if an abandoned email was already dispatched in the past 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Fetch carts updated 2+ hours ago (and within 7 days)
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('*')
      .lte('updated_at', twoHoursAgo)
      .gte('updated_at', sevenDaysAgo)
      .gt('quantity', 0);

    if (cartError) {
      console.warn('Cron cart_items query notice:', cartError.message);
      return res.status(200).json({
        success: false,
        notice: 'Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel environment variables and migration 20260919000014 is applied in Supabase.',
        details: cartError.message
      });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No abandoned carts found in target window (2h - 7d).',
        evaluatedUsers: 0,
        emailsSent: 0
      });
    }

    // Group items by user_id
    const userCartMap = new Map<string, CartItemRow[]>();
    for (const item of cartItems as CartItemRow[]) {
      if (!item.user_id) continue;
      const existing = userCartMap.get(item.user_id) || [];
      existing.push(item);
      userCartMap.set(item.user_id, existing);
    }

    const uniqueUserIds = Array.from(userCartMap.keys());
    let emailsSent = 0;
    let skipped = 0;
    const processLog: Array<{ userId: string; status: string; reason?: string }> = [];

    for (const userId of uniqueUserIds) {
      const items = userCartMap.get(userId)!;

      // Check if any item in this cart has an abandoned_email_sent_at within 24h
      const recentlyNotified = items.some(
        (i) => i.abandoned_email_sent_at && new Date(i.abandoned_email_sent_at) > new Date(twentyFourHoursAgo)
      );

      if (recentlyNotified) {
        skipped++;
        processLog.push({ userId, status: 'skipped', reason: 'Email sent within last 24 hours.' });
        continue;
      }

      // Check audit log table if present
      try {
        const { data: recentLogs } = await supabase
          .from('abandoned_cart_emails')
          .select('id')
          .eq('user_id', userId)
          .gte('sent_at', twentyFourHoursAgo)
          .limit(1);

        if (recentLogs && recentLogs.length > 0) {
          skipped++;
          processLog.push({ userId, status: 'skipped', reason: 'Recovery email already sent in 24h window.' });
          continue;
        }
      } catch (tableErr) {
        // Table may not yet be migrated, proceed with column check
      }

      // Check for matching completed or active order placed after cart was last updated
      const latestCartUpdate = items.reduce((latest, item) => {
        const itemDate = new Date(item.updated_at).getTime();
        return itemDate > latest ? itemDate : latest;
      }, 0);

      const { data: matchingOrders, error: orderErr } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .eq('customer_id', userId)
        .neq('status', 'cancelled')
        .gte('created_at', new Date(latestCartUpdate - 60000).toISOString())
        .limit(1);

      if (!orderErr && matchingOrders && matchingOrders.length > 0) {
        skipped++;
        processLog.push({ userId, status: 'skipped', reason: 'Customer completed order after cart update.' });
        continue;
      }

      // Fetch customer profile for known email
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id, email, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (custErr || !customer || !customer.email || !customer.email.includes('@')) {
        skipped++;
        processLog.push({ userId, status: 'skipped', reason: 'No known verified customer email found.' });
        continue;
      }

      const customerEmail = customer.email;
      const customerName = customer.full_name || 'Valued Client';
      const currency = items[0]?.currency || '$';
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const checkoutUrl = `${appUrl}/checkout`;

      // If Brevo API key is not configured, record in log and skip actual dispatch
      if (!brevoApiKey) {
        skipped++;
        processLog.push({ userId, status: 'simulated', reason: 'BREVO_API_KEY not configured.' });
        continue;
      }

      // Build HTML and plain text email
      const htmlContent = buildAbandonedCartEmailHtml({
        customerName,
        items,
        subtotal,
        currency,
        checkoutUrl,
        appUrl
      });

      const textContent = `
VB FITS STUDIOS — Shopping Bag Notice

Dear ${customerName},

You left something behind in your shopping bag. Your selected archival pieces remain reserved for a limited time:

${items.map((i) => `· ${i.name} (Size: ${i.size}, Qty: ${i.quantity}) — ${(i.price * i.quantity).toFixed(2)} ${currency}`).join('\n')}

Estimated Subtotal: ${subtotal.toFixed(2)} ${currency}

Complete your selection now:
${checkoutUrl}

VB Fits Studios · Private Client Services
concierge@vbfitsstudios.com
      `.trim();

      // Trigger Brevo transactional email
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify({
          sender: {
            name: 'VB Fits Studios',
            email: brevoSenderEmail
          },
          to: [{ email: customerEmail, name: customerName }],
          subject: 'You left something behind · Complete your VB Fits Studios selection',
          htmlContent,
          textContent,
          tags: ['abandoned-cart', 'p1-1']
        })
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        console.error(`Failed to send abandoned cart email to ${customerEmail}:`, errText);
        processLog.push({ userId, status: 'error', reason: `Brevo gateway error ${brevoRes.status}` });
        continue;
      }

      const nowIso = new Date().toISOString();

      // Update cart_items with abandoned_email_sent_at
      const itemIds = items.map((i) => i.id);
      await supabase
        .from('cart_items')
        .update({ abandoned_email_sent_at: nowIso })
        .in('id', itemIds);

      // Log into abandoned_cart_emails table
      try {
        await supabase.from('abandoned_cart_emails').insert({
          user_id: userId,
          customer_email: customerEmail,
          items: items.map((i) => ({
            product_id: i.product_id,
            name: i.name,
            size: i.size,
            price: i.price,
            quantity: i.quantity
          })),
          subtotal,
          currency,
          sent_at: nowIso
        });
      } catch (logErr) {
        console.warn('Notice writing to abandoned_cart_emails log table:', logErr);
      }

      emailsSent++;
      processLog.push({ userId, status: 'sent' });
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      evaluatedUsers: uniqueUserIds.length,
      emailsSent,
      skipped,
      log: processLog
    });
  } catch (err: any) {
    console.error('Unhandled exception in abandoned-carts cron:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error.' });
  }
}
