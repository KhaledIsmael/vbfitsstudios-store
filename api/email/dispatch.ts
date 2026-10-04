import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/email/dispatch
 *
 * Unified transactional email dispatcher via Resend REST API.
 * 100% self-contained to avoid Vercel ESM module resolution crashes.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Resolve Resend API Key
  let resendApiKey =
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    process.env.NEXT_PUBLIC_RESEND_API_KEY ||
    '';

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  if (!resendApiKey && supabase) {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'resend_api_key')
        .maybeSingle();
      if (data?.value) {
        resendApiKey = String(data.value).replace(/^["']|["']$/g, '').trim();
      }
    } catch {
      // fallback
    }
  }

  if (!resendApiKey || resendApiKey.includes('PASTE_YOUR')) {
    console.error('[dispatch] Resend API key is missing.');
    return res.status(500).json({ error: 'Missing or placeholder RESEND_API_KEY.' });
  }

  const { eventType, referenceId, recipientEmail, payload } = req.body || {};

  if (!eventType || !referenceId || !recipientEmail || !payload) {
    return res.status(400).json({ error: 'Missing required fields: eventType, referenceId, recipientEmail, payload' });
  }

  // 2. Prevent duplicate dispatches if database is available
  if (supabase) {
    try {
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id, status')
        .eq('event_type', eventType)
        .eq('reference_id', referenceId)
        .maybeSingle();

      if (existingLog && existingLog.status === 'sent') {
        return res.status(200).json({ success: true, message: 'Already dispatched', skipped: true });
      }
    } catch {
      // ignore
    }
  }

  let fromAddress =
    process.env.RESEND_FROM_EMAIL || 'VB FITS STUDIOS <noreply@vbfitsstudios.com>';
  if (fromAddress.includes('@gmail.com') || !fromAddress.includes('@vbfitsstudios.com')) {
    fromAddress = 'VB FITS STUDIOS <noreply@vbfitsstudios.com>';
  }

  // 3. Handle events
  try {
    let emailSubject = '';
    let emailHtml = '';
    let replyTo: string | undefined = undefined;

    switch (eventType) {
      case 'contact_inquiry_to_brand': {
        emailSubject = `[VB FITS] New Client Inquiry — ${payload.clientName || 'Inquiry'}`;
        replyTo = payload.clientEmail;
        emailHtml = buildBrandNotificationHtml({
          clientName: payload.clientName || 'Client',
          clientEmail: payload.clientEmail || recipientEmail,
          messageText: payload.message || '',
          submittedAt: new Date().toUTCString()
        });
        break;
      }

      case 'contact_autoreply': {
        emailSubject = 'We have received your message — VB FITS STUDIOS | تم استلام استفساركم';
        emailHtml = buildAutoReplyHtml({
          clientName: payload.clientName || 'Valued Client',
          originalMessage: payload.message || ''
        });
        break;
      }

      case 'order_confirmation': {
        emailSubject = `Order Confirmation — ${payload.orderNumber || referenceId}`;
        emailHtml = buildGenericEmailHtml({
          subject: emailSubject,
          headline: 'Thank you for your order.',
          customerName: payload.customerName || 'Valued Client',
          bodyText: [
            `We have received your order #${payload.orderNumber || referenceId} and are currently preparing it.`,
            `Total: ${payload.total || ''} ${payload.currency || 'EGP'}`
          ]
        });
        break;
      }

      case 'order_shipped': {
        emailSubject = `Your Order Has Shipped — ${payload.orderNumber || referenceId}`;
        emailHtml = buildGenericEmailHtml({
          subject: emailSubject,
          headline: 'Your items are on the way.',
          customerName: payload.customerName || 'Valued Client',
          bodyText: [
            `Great news! Your order #${payload.orderNumber || referenceId} has been dispatched.`,
            payload.trackingNumber ? `Tracking Number: ${payload.trackingNumber}` : ''
          ].filter(Boolean)
        });
        break;
      }

      case 'admin_notification': {
        emailSubject = `Admin Alert: ${payload.alertType || 'Notification'}`;
        emailHtml = buildGenericEmailHtml({
          subject: emailSubject,
          headline: payload.alertType || 'Admin Notification',
          customerName: 'Admin',
          bodyText: [payload.message || payload.messageText || '']
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported eventType: ${eventType}` });
    }

    // 4. Send via native Resend REST API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        reply_to: replyTo,
        subject: emailSubject,
        html: emailHtml
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[dispatch] Resend error:', response.status, data);
      if (supabase) {
        await supabase.from('email_logs').insert({
          event_type: eventType,
          reference_id: referenceId,
          recipient_email: recipientEmail,
          status: 'failed',
          error_details: JSON.stringify(data)
        }).catch(() => {});
      }
      return res.status(502).json({ error: 'Email delivery failed', details: data });
    }

    if (supabase) {
      await supabase.from('email_logs').insert({
        event_type: eventType,
        reference_id: referenceId,
        recipient_email: recipientEmail,
        status: 'sent',
        provider_message_id: data?.id
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('[dispatch] Server error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}

// ── HTML Templates (Inlined to prevent module resolution bugs) ───────────────

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

function buildBrandNotificationHtml(params: {
  clientName: string;
  clientEmail: string;
  messageText: string;
  submittedAt: string;
}): string {
  const { clientName, clientEmail, messageText, submittedAt } = params;
  const safeMessage = escapeHtml(messageText);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Client Inquiry — VB FITS STUDIOS</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #DEDEDE;">
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:#111111;padding:28px 40px;text-align:center;">
              <span style="font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge &nbsp;·&nbsp; Admin Notification</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#111111;padding:8px 20px;">
                <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;font-weight:700;">● &nbsp; New Inquiry Received</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;letter-spacing:0.04em;">A client has submitted a transmission</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#777777;">Review the inquiry details below. You can reply directly to the client.</p>
            </td>
          </tr>
          <tr><td style="padding:20px 40px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>
          <tr>
            <td style="padding:24px 40px;">
              <div style="background:#F9F9F9;border:1px solid #E8E8E8;padding:24px 28px;">
                <p style="margin:0 0 16px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Transmission Telemetry</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:12px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;width:35%;">Client Name</td>
                    <td style="padding-bottom:12px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:12px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;">Client Email</td>
                    <td style="padding-bottom:12px;font-size:13px;text-align:right;">
                      <a href="mailto:${clientEmail}" style="color:#111111;font-weight:600;text-decoration:underline;">${clientEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;">Received At</td>
                    <td style="font-size:12px;color:#555555;text-align:right;">${submittedAt}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="border-left:3px solid #111111;padding:20px 24px;background:#FAFAFA;">
                <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Inquiry Content / نص الشكوى</p>
                <p style="margin:0;font-size:13px;color:#222222;line-height:1.8;">${safeMessage}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="mailto:${clientEmail}?subject=Re%3A%20Your%20Inquiry%20%E2%80%94%20VB%20FITS%20STUDIOS"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:15px 32px;border:1px solid #111111;margin:4px;">
                Reply to Client / الرد على العميل
              </a>
              &nbsp;
              <a href="https://vbfitsstudios.com/admin"
                 style="display:inline-block;background:#FFFFFF;color:#111111;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:15px 28px;border:1px solid #111111;margin:4px;">
                Admin Dashboard
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#111111;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:9px;color:#666666;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS — STORE CONCIERGE</p>
            </td>
          </tr>
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAutoReplyHtml(params: {
  clientName: string;
  originalMessage: string;
}): string {
  const { clientName, originalMessage } = params;
  const safeMessage = escapeHtml(originalMessage);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>We have received your message — VB FITS STUDIOS</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge</span>
            </td>
          </tr>
          <tr>
            <td style="padding:44px 40px 16px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:300;color:#111111;letter-spacing:0.04em;">تم استلام رسالتكم بنجاح</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#888888;letter-spacing:0.15em;text-transform:uppercase;">Transmission Received</p>
              <div style="width:40px;height:1px;background:#C9A96E;margin:20px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;direction:rtl;text-align:right;">
              <p style="margin:0 0 14px;font-size:15px;color:#111111;font-weight:600;">عزيزنا العميل ${clientName}،</p>
              <p style="margin:0 0 14px;font-size:13px;color:#444444;line-height:1.8;">
                نشكركم لاختياركم <strong>VB FITS STUDIOS</strong> وتواصلكم معنا. نود إعلامكم بأنه تم استلام استفساركم بنجاح وتم تحويله إلى فريق خدمة العملاء للمراجعة والمتابعة.
              </p>
              <p style="margin:0 0 14px;font-size:13px;color:#444444;line-height:1.8;">
                خلال <strong>24 ساعة عمل</strong>، سيتواصل معكم أحد ممثلي خدمة العملاء للرد على استفساركم ومساعدتكم بأعلى معايير الاهتمام والجودة.
              </p>
            </td>
          </tr>
          <tr><td style="padding:16px 40px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>
          <tr>
            <td style="padding:16px 40px 8px;direction:ltr;text-align:left;">
              <p style="margin:0 0 10px;font-size:13px;color:#111111;font-weight:600;">Dear ${clientName},</p>
              <p style="margin:0 0 10px;font-size:12px;color:#555555;line-height:1.7;">
                Thank you for reaching out to <strong>VB FITS STUDIOS</strong>. Your inquiry has been successfully received. A dedicated client advisor will review your message and respond within <strong>24 business hours</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 24px;">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Your Inquiry / نص رسالتكم</p>
              <div style="border-left:3px solid #C9A96E;padding:16px 20px;background:#FAFAF8;">
                <p style="margin:0;font-size:12px;color:#555555;line-height:1.8;font-style:italic;">${safeMessage}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:#111111;padding:20px 28px;text-align:center;">
                <p style="margin:0;font-size:10px;color:#C9A96E;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">Our Commitment</p>
                <p style="margin:8px 0 0;font-size:11px;color:#AAAAAA;line-height:1.7;">
                  Every client is attended to with the same care and precision we put into every stitch of our garments.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;color:#999999;text-transform:uppercase;">Direct Concierge Email</p>
              <a href="mailto:vbfitsstudios@gmail.com" style="font-size:12px;color:#111111;font-weight:600;text-decoration:underline;">vbfitsstudios@gmail.com</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="https://vbfitsstudios.com"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 40px;border:1px solid #111111;">
                Explore Collection / زيارة المتجر
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#F5F5F5;padding:24px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:9px;color:#999999;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.</p>
            </td>
          </tr>
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildGenericEmailHtml(params: {
  subject: string;
  headline: string;
  customerName: string;
  bodyText: string[];
}): string {
  const { subject, headline, customerName, bodyText } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;max-width:600px;width:100%;">
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-size:12px;font-weight:600;color:#FFFFFF;letter-spacing:0.3em;text-transform:uppercase;">VB FITS STUDIOS</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 16px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;">${escapeHtml(headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;text-align:center;">
              <p style="margin:0 0 16px;font-size:13px;color:#555555;">Hi ${escapeHtml(customerName)},</p>
              ${bodyText.map(t => `<p style="margin:0 0 14px;font-size:13px;color:#555555;line-height:1.7;">${escapeHtml(t)}</p>`).join('')}
            </td>
          </tr>
          <tr>
            <td style="background:#F5F5F5;padding:24px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
