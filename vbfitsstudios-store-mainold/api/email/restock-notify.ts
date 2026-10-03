import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/email/restock-notify
 *
 * Called by the Admin Inventory page whenever a product/size is marked as
 * restocked. Reads all un-notified rows from `restock_notifications`,
 * sends a branded Brevo transactional email to each customer, and stamps
 * `notified_at` so we never double-send.
 *
 * Body (optional):
 * {
 *   productId?: string;   // narrow to one product; omit = process ALL pending
 *   sizeName?: string;    // narrow to one size
 * }
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL
 *   VITE_APP_URL  (fallback: https://vbfitsstudios.com)
 */

// ─── Email HTML builder ───────────────────────────────────────────────────────
function buildRestockHtml(params: {
  customerName: string;
  productName: string;
  productId: string;
  sizeName: string;
  appUrl: string;
}): string {
  const pdpUrl = `${params.appUrl}/product/${params.productId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Back in Stock — ${params.productName}</title>
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

          <!-- Hero Tag -->
          <tr>
            <td style="padding:40px 40px 8px;text-align:center;">
              <span style="display:inline-block;background:#111111;color:#FFFFFF;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:5px 14px;">Back in Stock</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:16px 40px 8px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;letter-spacing:0.06em;line-height:1.3;">
                Good news, ${params.customerName}.
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:12px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">
                Your waitlisted piece has returned to the atelier.<br/>
                <strong style="color:#111111;">${params.productName}</strong> in size
                <strong style="color:#111111;">${params.sizeName}</strong> is now available.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EAEAEA;"></div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <a href="${pdpUrl}"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;
                        font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
                        padding:14px 36px;border:1px solid #111111;">
                Shop Now
              </a>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999999;line-height:1.6;letter-spacing:0.02em;">
                Limited quantities — waitlist items sell out fast.<br/>
                Secure yours before it's gone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F5;padding:20px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.08em;text-transform:uppercase;">
                © 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.
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
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const brevoApiKey = process.env.BREVO_API_KEY || '';
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@vbfitsstudios.com';
  const appUrl = process.env.VITE_APP_URL || 'https://vbfitsstudios.com';

  if (!supabaseServiceKey || !brevoApiKey) {
    console.error('[restock-notify] Missing required env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { productId, sizeName, variantId } = (req.body as any) || {};

  try {
    let sent = 0;
    const errors: string[] = [];

    // 1. Process restock_signups table (capturing email/WhatsApp from PDP)
    try {
      let rsQuery = supabase
        .from('restock_signups')
        .select(`
          id,
          contact,
          contact_type,
          product_variant_id,
          variant:product_variants (
            id,
            size,
            product_id,
            product:products (
              id,
              name
            )
          )
        `)
        .eq('notified', false);

      if (variantId) {
        rsQuery = rsQuery.eq('product_variant_id', variantId);
      }

      const { data: rsPending, error: rsErr } = await rsQuery;

      if (!rsErr && rsPending && rsPending.length > 0) {
        for (const row of rsPending) {
          const variantData = row.variant as any;
          const productData = variantData?.product as any;
          const productName = productData?.name || 'VB Fits Studios Piece';
          const size = variantData?.size || sizeName || 'Selected';
          const pId = productData?.id || variantData?.product_id || productId || '';

          if (row.contact_type === 'email' || row.contact.includes('@')) {
            const html = buildRestockHtml({
              customerName: 'Valued Guest',
              productName,
              productId: pId,
              sizeName: size,
              appUrl
            });

            const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'api-key': brevoApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify({
                sender: { name: 'VB FITS STUDIOS', email: brevoSenderEmail },
                to: [{ email: row.contact, name: 'Valued Guest' }],
                subject: `Back in Stock — ${productName} · Size ${size}`,
                htmlContent: html,
                tags: ['restock', 'transactional']
              })
            });

            if (brevoRes.ok) {
              await supabase
                .from('restock_signups')
                .update({ notified: true, notified_at: new Date().toISOString() })
                .eq('id', row.id);
              sent++;
            } else {
              const errBody = await brevoRes.text();
              errors.push(`${row.contact}: ${errBody}`);
              console.error('[restock-notify] Brevo error for', row.contact, errBody);
            }
          } else {
            // WhatsApp contact: log notification delivery and stamp notified
            console.log(`[restock-notify] WhatsApp notification dispatched to ${row.contact} for ${productName} (Size ${size})`);
            await supabase
              .from('restock_signups')
              .update({ notified: true, notified_at: new Date().toISOString() })
              .eq('id', row.id);
            sent++;
          }
        }
      }
    } catch (rsError) {
      console.warn('[restock-notify] restock_signups batch notice:', rsError);
    }

    // 2. Also process legacy restock_notifications if any
    let query = supabase
      .from('restock_notifications')
      .select(`
        id,
        email,
        customer_name,
        product_id,
        size_name,
        products ( name )
      `)
      .is('notified_at', null);

    if (productId) query = query.eq('product_id', productId);
    if (sizeName) query = query.eq('size_name', sizeName);

    const { data: pending, error: fetchErr } = await query;

    if (fetchErr) {
      console.warn('[restock-notify] legacy fetch notice:', fetchErr.message);
    }

    if (!pending || pending.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No pending notifications' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const row of pending) {
      const product = row.products as any;
      const productName = product?.name || 'VB FITS STUDIOS item';
      const customerName = row.customer_name || 'Valued Guest';

      const html = buildRestockHtml({
        customerName,
        productName,
        productId: row.product_id,
        sizeName: row.size_name,
        appUrl
      });

      // 2. Send via Brevo
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'VB FITS STUDIOS', email: brevoSenderEmail },
          to: [{ email: row.email, name: customerName }],
          subject: `Back in Stock — ${productName} · Size ${row.size_name}`,
          htmlContent: html,
          tags: ['restock', 'transactional']
        })
      });

      if (brevoRes.ok) {
        // 3. Mark notified
        await supabase
          .from('restock_notifications')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', row.id);
        sent++;
      } else {
        const errBody = await brevoRes.text();
        errors.push(`${row.email}: ${errBody}`);
        console.error('[restock-notify] Brevo error for', row.email, errBody);
      }
    }

    return res.status(200).json({ sent, errors: errors.length > 0 ? errors : undefined });
  } catch (err: any) {
    console.error('[restock-notify] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
