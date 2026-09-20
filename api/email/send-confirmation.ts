import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/email/send-confirmation
 *
 * Fires after a successful order creation to send a transactional HTML
 * confirmation email via Brevo (formerly Sendinblue) free-tier API.
 *
 * Body: {
 *   to: string;            // recipient email
 *   toName?: string;       // recipient display name
 *   orderNumber: string;   // VBF-XXXXX
 *   orderId: string;       // Supabase UUID (for confirmation page deep-link)
 *   trackingNumber: string;
 *   total: number;
 *   currency?: string;
 *   paymentMethod: string; // 'COD' | 'Pay Online'
 *   paymentStatus: string;
 *   deliveryWindow: string;// e.g. "Mon, Sep 22 – Wed, Sep 24"
 *   address?: {
 *     name?: string; street?: string; building?: string;
 *     floor?: string; city?: string; governorate?: string;
 *   };
 *   items: Array<{
 *     name: string; size: string; quantity: number; price: number;
 *   }>;
 * }
 */

// ─── HTML Email Template ─────────────────────────────────────────────────────
function buildEmailHtml(data: {
  toName: string;
  orderNumber: string;
  orderId: string;
  trackingNumber: string;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryWindow: string;
  isCOD: boolean;
  address?: any;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  appUrl: string;
}): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #EAEAEA; vertical-align: top;">
          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #111111; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 2px;">
            ${item.name}
          </span>
          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 0.06em;">
            Size: ${item.size} &nbsp;·&nbsp; Qty: ${item.quantity}
          </span>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #EAEAEA; text-align: right; vertical-align: top;">
          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #111111; font-weight: 600;">
            ${(item.price * item.quantity).toFixed(2)} ${data.currency}
          </span>
        </td>
      </tr>`
    )
    .join('');

  const addressBlock = data.address
    ? `
    <div style="margin-top: 24px; padding: 16px 20px; border: 1px solid #EAEAEA; background: #FAFAFA;">
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 8px 0;">
        Delivery Destination
      </p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #111111; font-weight: 600; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.06em;">
        ${data.address.name || ''}
      </p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #555555; margin: 0 0 2px 0;">
        ${data.address.street || ''}${data.address.building ? `, Bldg ${data.address.building}` : ''}${data.address.floor ? `, Floor ${data.address.floor}` : ''}
      </p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #888888; margin: 0; text-transform: uppercase; letter-spacing: 0.06em;">
        ${data.address.city || ''}${data.address.governorate ? `, ${data.address.governorate}` : ''}
      </p>
    </div>`
    : '';

  const codNotice = data.isCOD
    ? `
    <div style="margin-top: 24px; padding: 16px 20px; border: 1px solid #EAEAEA; border-left: 3px solid #111111; background: #FFFFFF;">
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9px; color: #111111; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 6px 0;">
        Cash on Delivery
      </p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #555555; line-height: 1.6; margin: 0;">
        Please prepare the exact amount of <strong style="color: #111111;">${data.total.toFixed(2)} ${data.currency}</strong> in cash or via POS card machine when our courier contacts you before arrival.
      </p>
    </div>`
    : '';

  const confirmationUrl = `${data.appUrl}/order-confirmation/${data.orderId}`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Order Confirmed — VB Fits Studios</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Email wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F5F5; padding: 40px 20px;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #EAEAEA;">

          <!-- Header -->
          <tr>
            <td style="background-color: #111111; padding: 32px 40px; text-align: center;">
              <p style="margin: 0; color: #FFFFFF; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 400; margin-bottom: 6px;">
                Private Dispatch Registry
              </p>
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase;">
                VB FITS STUDIOS
              </h1>
            </td>
          </tr>

          <!-- Confirmation badge row -->
          <tr>
            <td style="background-color: #FAFAFA; border-bottom: 1px solid #EAEAEA; padding: 28px 40px; text-align: center;">
              <div style="display: inline-block; width: 44px; height: 44px; border: 1.5px solid #111111; border-radius: 50%; text-align: center; line-height: 44px; margin-bottom: 14px;">
                <span style="font-size: 18px; color: #111111;">✓</span>
              </div>
              <p style="margin: 0 0 4px 0; font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.16em;">
                Acquisition Confirmed
              </p>
              <h2 style="margin: 0; font-size: 20px; font-weight: 300; color: #111111; letter-spacing: 0.1em; text-transform: uppercase;">
                Order Placed Successfully
              </h2>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #666666; line-height: 1.6; max-width: 380px; margin-left: auto; margin-right: auto;">
                Dear ${data.toName}, your garments have been registered in our private dispatch registry. A courier will be in touch before arrival.
              </p>
            </td>
          </tr>

          <!-- Order meta grid -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.12em;">Order Reference</td>
                        <td style="font-size: 11px; color: #111111; font-weight: 700; text-align: right; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'Courier New', Courier, monospace;">${data.orderNumber}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.12em;">Tracking ID</td>
                        <td style="font-size: 11px; color: #111111; font-family: 'Courier New', Courier, monospace; text-align: right;">${data.trackingNumber || '—'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.12em;">Settlement</td>
                        <td style="font-size: 11px; color: #111111; font-weight: 600; text-align: right; text-transform: uppercase; letter-spacing: 0.06em;">${data.isCOD ? 'Cash on Delivery' : 'Paid Online'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 14px 0; border-bottom: 1px solid #EAEAEA;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.12em;">Estimated Delivery</td>
                        <td style="font-size: 11px; color: #111111; font-weight: 600; text-align: right;">${data.deliveryWindow}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 18px 0; border-bottom: 1px solid #EAEAEA;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 11px; color: #111111; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Total Value</td>
                        <td style="font-size: 14px; color: #111111; font-weight: 700; text-align: right;">${data.total.toFixed(2)} ${data.currency}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Items list -->
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <p style="margin: 0 0 12px 0; font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.14em; border-bottom: 1px solid #EAEAEA; padding-bottom: 8px;">
                Garments in This Acquisition
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Address + COD notice -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              ${addressBlock}
              ${codNotice}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid #EAEAEA;">
              <a href="${confirmationUrl}"
                 style="display: inline-block; background-color: #111111; color: #FFFFFF; text-decoration: none; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; padding: 14px 36px;">
                View Full Order Details
              </a>
            </td>
          </tr>

          <!-- Promise strip -->
          <tr>
            <td style="padding: 0 40px 28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #EAEAEA;">
                ${['Archival luxury box & garment bag included', 'Discreet express courier transit with tracking', '14-day returns & complimentary sizing exchange']
                  .map(
                    (line) => `
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #EAEAEA; font-size: 9px; color: #777777; text-transform: uppercase; letter-spacing: 0.1em;">
                    <span style="color: #111111; margin-right: 8px;">✦</span>${line}
                  </td>
                </tr>`
                  )
                  .join('')}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111111; padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 9px; color: #888888; text-transform: uppercase; letter-spacing: 0.14em;">
                VB Fits Studios · Private Client Services
              </p>
              <p style="margin: 0; font-size: 9px; color: #555555; line-height: 1.6;">
                This is an automated dispatch confirmation. For inquiries, reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Delivery window helper (matches frontend) ────────────────────────────────
function getDeliveryWindow(createdAt?: string): string {
  const base = createdAt ? new Date(createdAt) : new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lo = new Date(base);
  lo.setDate(lo.getDate() + 3);
  const hi = new Date(base);
  hi.setDate(hi.getDate() + 6);
  return `${fmt(lo)} – ${fmt(hi)}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.error('BREVO_API_KEY not set — skipping confirmation email.');
    // Return 200 so order flow isn't blocked
    return res.status(200).json({ sent: false, reason: 'Email service not configured.' });
  }

  const {
    to,
    toName = 'Valued Client',
    orderNumber,
    orderId,
    trackingNumber = '',
    total = 0,
    currency = 'USD',
    paymentMethod = 'COD',
    paymentStatus = 'pending_collection',
    deliveryWindow,
    address,
    items = [],
    createdAt
  } = req.body || {};

  if (!to || !orderNumber || !orderId) {
    return res.status(400).json({ error: 'Missing required fields: to, orderNumber, orderId' });
  }

  const isCOD = paymentMethod === 'COD' || paymentMethod === 'Cash on Delivery';
  const appUrl = process.env.VITE_APP_URL || 'https://vbfitsstudios.com';
  const window_ = deliveryWindow || getDeliveryWindow(createdAt);

  const htmlContent = buildEmailHtml({
    toName,
    orderNumber,
    orderId,
    trackingNumber,
    total,
    currency,
    paymentMethod,
    paymentStatus,
    deliveryWindow: window_,
    isCOD,
    address,
    items,
    appUrl
  });

  const textContent = `
VB FITS STUDIOS — Order Confirmed

Dear ${toName},

Your order ${orderNumber} has been placed successfully.

Tracking ID: ${trackingNumber || 'Pending'}
Payment: ${isCOD ? 'Cash on Delivery' : 'Paid Online'}
Estimated Delivery: ${window_}
Total: ${total.toFixed(2)} ${currency}

View your order: ${appUrl}/order-confirmation/${orderId}

VB Fits Studios · Private Client Services
  `.trim();

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'VB Fits Studios',
          email: process.env.BREVO_SENDER_EMAIL || 'orders@vbfitsstudios.com'
        },
        to: [{ email: to, name: toName }],
        subject: `Order Confirmed — ${orderNumber} · VB Fits Studios`,
        htmlContent,
        textContent,
        tags: ['order-confirmation', orderNumber]
      })
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.text();
      console.error('Brevo API error:', brevoRes.status, errBody);
      return res
        .status(502)
        .json({ sent: false, error: `Email gateway error ${brevoRes.status}` });
    }

    const brevoData = await brevoRes.json();
    console.log(`Confirmation email sent → ${to} (messageId: ${brevoData.messageId})`);
    return res.status(200).json({ sent: true, messageId: brevoData.messageId });
  } catch (err: any) {
    console.error('send-confirmation exception:', err);
    // Non-blocking — order already created, don't fail
    return res.status(200).json({ sent: false, error: err?.message });
  }
}
