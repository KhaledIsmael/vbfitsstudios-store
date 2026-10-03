import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/email/return-refunded
 *
 * Sends an email to the customer when a return request is marked as refunded.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const brevoApiKey = process.env.BREVO_API_KEY || '';
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@vbfitsstudios.com';

  if (!brevoApiKey) {
    return res.status(500).json({ error: 'BREVO_API_KEY not configured' });
  }

  const { customerEmail, customerName, orderNumber, amount, method, transactionRef } = req.body || {};

  if (!customerEmail || !orderNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const name = customerName || 'Valued Guest';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Refund Confirmation — ${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;max-width:600px;width:100%;">
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#FFFFFF;letter-spacing:0.25em;text-transform:uppercase;">VB FITS STUDIOS</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 8px;text-align:center;">
              <span style="font-size:28px;">💳</span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">
                Your refund has been dispatched.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 16px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">
                Hi ${name},<br/>
                We have successfully processed a refund for your return on order <strong>${orderNumber}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <div style="background:#F9F9F9;border:1px solid #EAEAEA;padding:24px;">
                <p style="margin:0 0 12px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.1em;">Refund Details</p>
                <p style="margin:0 0 8px;font-size:14px;color:#111111;">Amount: <strong>EGP ${amount.toFixed(2)}</strong></p>
                <p style="margin:0 0 8px;font-size:14px;color:#111111;">Method: <strong>${method || 'Original Payment Method'}</strong></p>
                <p style="margin:0;font-size:12px;color:#555555;">Ref: ${transactionRef}</p>
              </div>
            </td>
          </tr>
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
        subject: `Refund Confirmation — ${orderNumber}`,
        htmlContent: html,
        tags: ['return-refunded', 'transactional']
      })
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      return res.status(502).json({ error: 'Email delivery failed', detail: errText });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
