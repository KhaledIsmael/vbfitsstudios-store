import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/email/order-status
 *
 * Fires when an admin changes an order's status (e.g. processing → shipped).
 * Sends a branded Brevo transactional status-update email to the customer.
 *
 * Body:
 * {
 *   customerEmail: string;
 *   customerName?: string;
 *   orderNumber: string;       // Display ID, e.g. "VBF-00042"
 *   orderId: string;           // Supabase UUID for deep-link
 *   newStatus: string;         // e.g. "shipped", "delivered", "processing"
 *   trackingNumber?: string;
 *   currency?: string;
 *   total?: number;
 * }
 *
 * Required env vars:
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL
 *   VITE_APP_URL
 */

// ─── Status metadata ──────────────────────────────────────────────────────────
type StatusKey = 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | string;

interface StatusMeta {
  label: string;
  headline: string;
  body: string;
  emoji: string;
  showTracking: boolean;
}

function getStatusMeta(status: StatusKey): StatusMeta {
  const map: Record<string, StatusMeta> = {
    processing: {
      label: 'Processing',
      headline: 'Your order is being prepared.',
      body: 'Our atelier team is carefully packaging your pieces. You\'ll receive another update when your order ships.',
      emoji: '📦',
      showTracking: false
    },
    shipped: {
      label: 'Shipped',
      headline: 'Your order is on its way.',
      body: 'Your package has left our facility and is in transit. Use your tracking number below to follow its journey.',
      emoji: '🚚',
      showTracking: true
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      headline: 'Your order arrives today.',
      body: 'Your package is out for delivery and should arrive at your address today. Please ensure someone is available to receive it.',
      emoji: '📬',
      showTracking: true
    },
    delivered: {
      label: 'Delivered',
      headline: 'Your order has been delivered.',
      body: 'Your VB FITS STUDIOS pieces have arrived. We hope you love them as much as we loved crafting them.',
      emoji: '✅',
      showTracking: false
    },
    cancelled: {
      label: 'Cancelled',
      headline: 'Your order has been cancelled.',
      body: 'Your order has been cancelled as requested. Any payment will be refunded within 5–7 business days.',
      emoji: '❌',
      showTracking: false
    },
    refunded: {
      label: 'Refunded',
      headline: 'Your refund has been processed.',
      body: 'Your refund has been initiated and should appear in your account within 5–7 business days depending on your bank.',
      emoji: '💳',
      showTracking: false
    }
  };

  return map[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    headline: 'Your order status has been updated.',
    body: `Your order status has changed to: ${status}.`,
    emoji: '🔔',
    showTracking: false
  };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildStatusHtml(params: {
  customerName: string;
  orderNumber: string;
  orderId: string;
  status: StatusMeta;
  rawStatus: string;
  trackingNumber?: string;
  total?: number;
  currency?: string;
  appUrl: string;
}): string {
  const orderUrl = `${params.appUrl}/order-confirmation/${params.orderId}`;
  const trackUrl = `${params.appUrl}/orders/${params.orderId}/track`;
  const currency = params.currency || '$';

  const trackingBlock = params.status.showTracking && params.trackingNumber
    ? `<tr>
        <td style="padding:16px 40px 0;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#999999;letter-spacing:0.15em;text-transform:uppercase;">Tracking Number</p>
          <a href="${trackUrl}" style="font-size:14px;font-weight:600;color:#111111;letter-spacing:0.1em;text-decoration:none;">
            ${params.trackingNumber}
          </a>
        </td>
      </tr>`
    : '';

  const totalBlock = params.total
    ? `<tr>
        <td style="padding:8px 40px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#888888;letter-spacing:0.04em;">
            Order Total: <strong style="color:#111111;">${currency}${params.total.toFixed(2)}</strong>
          </p>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Order Update — ${params.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#FFFFFF;letter-spacing:0.25em;text-transform:uppercase;">VB FITS STUDIOS</span>
            </td>
          </tr>

          <!-- Status Badge -->
          <tr>
            <td style="padding:40px 40px 8px;text-align:center;">
              <span style="font-size:28px;">${params.status.emoji}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px;text-align:center;">
              <span style="display:inline-block;background:#111111;color:#FFFFFF;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:5px 14px;">
                ${params.status.label}
              </span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:16px 40px 8px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">
                ${params.status.headline}
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:8px 40px 16px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">
                Hi ${params.customerName},<br/>
                ${params.status.body}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EAEAEA;"></div>
            </td>
          </tr>

          <!-- Order Number -->
          <tr>
            <td style="padding:24px 40px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#999999;letter-spacing:0.15em;text-transform:uppercase;">Order Reference</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#111111;letter-spacing:0.12em;">${params.orderNumber}</p>
            </td>
          </tr>

          <!-- Tracking (conditional) -->
          ${trackingBlock}

          <!-- Total (conditional) -->
          ${totalBlock}

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <a href="${orderUrl}"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;
                        font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
                        padding:14px 36px;border:1px solid #111111;">
                View Order
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F5;padding:20px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.08em;text-transform:uppercase;">
                © 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.
              </p>
              <p style="margin:6px 0 0;font-size:10px;color:#CCCCCC;">
                Questions? Reply to this email or contact us via WhatsApp.
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

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const brevoApiKey = process.env.BREVO_API_KEY || '';
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@vbfitsstudios.com';
  const appUrl = process.env.VITE_APP_URL || 'https://vbfitsstudios.com';

  if (!brevoApiKey) {
    return res.status(500).json({ error: 'BREVO_API_KEY not configured' });
  }

  const {
    customerEmail,
    customerName,
    orderNumber,
    orderId,
    newStatus,
    trackingNumber,
    currency,
    total
  } = (req.body as any) || {};

  if (!customerEmail || !orderNumber || !orderId || !newStatus) {
    return res.status(400).json({ error: 'Missing required fields: customerEmail, orderNumber, orderId, newStatus' });
  }

  const statusMeta = getStatusMeta(newStatus);
  const name = customerName || 'Valued Guest';

  const html = buildStatusHtml({
    customerName: name,
    orderNumber,
    orderId,
    status: statusMeta,
    rawStatus: newStatus,
    trackingNumber,
    total,
    currency,
    appUrl
  });

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'VB FITS STUDIOS', email: brevoSenderEmail },
        to: [{ email: customerEmail, name }],
        subject: `Order Update — ${statusMeta.label} · ${orderNumber}`,
        htmlContent: html,
        tags: ['order-status', 'transactional']
      })
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error('[order-status] Brevo error:', errText);
      return res.status(502).json({ error: 'Email delivery failed', detail: errText });
    }

    return res.status(200).json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('[order-status] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
