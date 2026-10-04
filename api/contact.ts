import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/contact
 *
 * Dedicated, 100% self-contained serverless handler for Contact Us form submissions.
 * - Zero local relative imports (avoids Vercel ESM resolution crashes).
 * - Uses native fetch to call Resend REST API (no SDK bundling issues).
 * - Dispatches two luxury emails:
 *     1) Brand Notification -> vbfitsstudios@gmail.com (with reply_to set to client)
 *     2) Auto-Reply -> customer's email (luxury bilingual confirmation)
 * - Persists message in Supabase contact_messages and logs to email_logs.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & method check
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields: name, email, message' });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanMessage = String(message).trim();

    // 1. Resolve Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // 2. Persist message to Supabase contact_messages table
    if (supabase) {
      try {
        await supabase.from('contact_messages').insert({
          name: cleanName,
          email: cleanEmail,
          message: cleanMessage,
          status: 'unread'
        });
      } catch (dbErr) {
        console.warn('[contact] Warning saving to contact_messages:', dbErr);
      }
    }

    // 3. Resolve Resend API Key (env vars -> Supabase store_settings -> site_settings)
    let resendApiKey =
      process.env.RESEND_API_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      process.env.NEXT_PUBLIC_RESEND_API_KEY ||
      '';

    if (!resendApiKey && supabase) {
      try {
        const { data: storeSetting } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'resend_api_key')
          .maybeSingle();

        if (storeSetting?.value) {
          resendApiKey = String(storeSetting.value).replace(/^["']|["']$/g, '').trim();
        }

        if (!resendApiKey) {
          const { data: siteSetting } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'resend_api_key')
            .maybeSingle();
          if (siteSetting?.value) {
            resendApiKey = String(siteSetting.value).replace(/^["']|["']$/g, '').trim();
          }
        }
      } catch (e) {
        console.warn('[contact] Could not query DB for resend_api_key:', e);
      }
    }

    // 4. Resolve Brand destination email & sender
    let brandEmail = process.env.BRAND_NOTIFICATION_EMAIL || 'vbfitsstudios@gmail.com';
    if (supabase) {
      try {
        const { data: brandSetting } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'brand_notification_email')
          .maybeSingle();
        if (brandSetting?.value) {
          brandEmail = String(brandSetting.value).replace(/^["']|["']$/g, '').trim();
        }
      } catch {
        // Keep default brandEmail
      }
    }

    // Sender MUST use the verified domain (@vbfitsstudios.com).
    // If RESEND_FROM_EMAIL was mistakenly set to a @gmail.com address in Vercel, force the verified domain.
    let fromAddress = process.env.RESEND_FROM_EMAIL || 'VB FITS STUDIOS <noreply@vbfitsstudios.com>';
    if (fromAddress.includes('@gmail.com') || !fromAddress.includes('@vbfitsstudios.com')) {
      fromAddress = 'VB FITS STUDIOS <noreply@vbfitsstudios.com>';
    }

    // If no API key configured anywhere, return graceful response
    if (!resendApiKey || resendApiKey.includes('PASTE_YOUR')) {
      console.error('[contact] Resend API key is not configured.');
      return res.status(200).json({
        success: true,
        emailSent: false,
        message: 'Inquiry saved to database. Email delivery requires RESEND_API_KEY in Vercel or Supabase store_settings.'
      });
    }

    // 5. Generate luxury HTML templates
    const brandNotificationHtml = buildBrandNotificationHtml({
      clientName: cleanName,
      clientEmail: cleanEmail,
      messageText: cleanMessage,
      submittedAt: new Date().toUTCString()
    });

    const autoReplyHtml = buildAutoReplyHtml({
      clientName: cleanName,
      originalMessage: cleanMessage
    });

    // 6. Send both emails in parallel via Resend REST API
    const [brandResult, autoReplyResult] = await Promise.allSettled([
      // Email 1: To Brand Owner
      sendViaResend(resendApiKey, {
        from: fromAddress,
        to: [brandEmail],
        reply_to: cleanEmail,
        subject: `[VB FITS] New Client Inquiry — ${cleanName}`,
        html: brandNotificationHtml
      }),

      // Email 2: Auto-reply to Customer
      sendViaResend(resendApiKey, {
        from: fromAddress,
        to: [cleanEmail],
        subject: 'We have received your message — VB FITS STUDIOS | تم استلام استفساركم',
        html: autoReplyHtml
      })
    ]);

    const brandOk = brandResult.status === 'fulfilled' && (brandResult.value as any)?.ok === true;
    const autoReplyOk = autoReplyResult.status === 'fulfilled' && (autoReplyResult.value as any)?.ok === true;

    // Log failures for telemetry
    if (!brandOk) {
      const err = brandResult.status === 'rejected' ? brandResult.reason : (brandResult.value as any)?.error;
      console.error('[contact] Brand notification email failed:', err);
    }
    if (!autoReplyOk) {
      const err = autoReplyResult.status === 'rejected' ? autoReplyResult.reason : (autoReplyResult.value as any)?.error;
      console.error('[contact] Customer auto-reply email failed:', err);
    }

    // 7. Record logs in email_logs table if available
    if (supabase) {
      const logs = [];
      if (brandOk) {
        logs.push({
          event_type: 'contact_inquiry_to_brand',
          reference_id: `contact-brand-${Date.now()}`,
          recipient_email: brandEmail,
          status: 'sent',
          provider_message_id: (brandResult as any).value?.data?.id
        });
      }
      if (autoReplyOk) {
        logs.push({
          event_type: 'contact_autoreply',
          reference_id: `contact-reply-${Date.now()}`,
          recipient_email: cleanEmail,
          status: 'sent',
          provider_message_id: (autoReplyResult as any).value?.data?.id
        });
      }
      if (logs.length > 0) {
        try {
          await supabase.from('email_logs').insert(logs);
        } catch {
          // ignore log insert errors
        }
      }
    }

    return res.status(200).json({
      success: true,
      brandNotificationSent: brandOk,
      autoReplySent: autoReplyOk,
      details: {
        brandError: brandOk ? null : (brandResult as any).value?.error || (brandResult as any).reason || 'Failed',
        autoReplyError: autoReplyOk ? null : (autoReplyResult as any).value?.error || (autoReplyResult as any).reason || 'Failed'
      }
    });
  } catch (fatalErr: any) {
    console.error('[contact fatal]', fatalErr);
    return res.status(500).json({
      error: 'Internal server error in contact handler',
      message: fatalErr?.message || String(fatalErr)
    });
  }
}

// ── Native Resend REST Client (No SDK Dependencies) ──────────────────────────

async function sendViaResend(
  apiKey: string,
  payload: {
    from: string;
    to: string[];
    reply_to?: string;
    subject: string;
    html: string;
  }
) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, status: response.status, error: data };
    }

    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ── Luxury Email HTML Builders ───────────────────────────────────────────────

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
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#F2F2F2;line-height:1px;max-height:0;overflow:hidden;">
    New inquiry from ${clientName} (${clientEmail})
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #DEDEDE;">

          <!-- Gold Top Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:28px 40px;text-align:center;">
              <span style="font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge &nbsp;·&nbsp; Admin Notification</span>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#111111;padding:8px 20px;">
                <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;font-weight:700;">● &nbsp; New Inquiry Received</span>
              </div>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:16px 40px 8px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">A client has submitted a transmission</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#777777;line-height:1.6;">Review the inquiry details below. You can reply directly to the client from your inbox.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:20px 40px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>

          <!-- Telemetry Table -->
          <tr>
            <td style="padding:24px 40px;">
              <div style="background:#F9F9F9;border:1px solid #E8E8E8;padding:24px 28px;">
                <p style="margin:0 0 16px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Transmission Telemetry</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:12px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;width:35%;">Client Name</td>
                    <td style="padding-bottom:12px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:12px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;">Client Email</td>
                    <td style="padding-bottom:12px;font-size:13px;text-align:right;">
                      <a href="mailto:${clientEmail}" style="color:#111111;font-weight:600;text-decoration:underline;">${clientEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;">Received At</td>
                    <td style="font-size:12px;color:#555555;text-align:right;">${submittedAt}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="border-left:3px solid #111111;padding:20px 24px;background:#FAFAFA;">
                <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Inquiry Content / نص الشكوى أو الرسالة</p>
                <p style="margin:0;font-size:13px;color:#222222;line-height:1.8;">${safeMessage}</p>
              </div>
            </td>
          </tr>

          <!-- Action Buttons -->
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

          <!-- Footer -->
          <tr>
            <td style="background:#111111;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:9px;color:#666666;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS — STORE CONCIERGE</p>
            </td>
          </tr>

          <!-- Gold Bottom Bar -->
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
<body style="margin:0;padding:0;background:#F5F4F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#F5F4F2;line-height:1px;max-height:0;overflow:hidden;">
    شكراً لاختياركم وتواصلكم مع VB FITS STUDIOS — تم استلام استفساركم بنجاح.
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">

          <!-- Gold Top Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:44px 40px 16px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">
                تم استلام رسالتكم بنجاح
              </h1>
              <p style="margin:8px 0 0;font-size:12px;color:#888888;letter-spacing:0.15em;text-transform:uppercase;">
                Transmission Received
              </p>
              <div style="width:40px;height:1px;background:#C9A96E;margin:20px auto 0;"></div>
            </td>
          </tr>

          <!-- Arabic Greeting & Reassurance -->
          <tr>
            <td style="padding:16px 40px 8px;direction:rtl;text-align:right;">
              <p style="margin:0 0 14px;font-size:15px;color:#111111;font-weight:600;line-height:1.6;">
                عزيزنا العميل ${clientName}،
              </p>
              <p style="margin:0 0 14px;font-size:13px;color:#444444;line-height:1.8;">
                نشكركم لاختياركم <strong>VB FITS STUDIOS</strong> وتواصلكم معنا. نود إعلامكم بأنه تم استلام استفساركم بنجاح وتم تحويله إلى فريق خدمة العملاء للمراجعة والمتابعة.
              </p>
              <p style="margin:0 0 14px;font-size:13px;color:#444444;line-height:1.8;">
                خلال <strong>24 ساعة عمل</strong>، سيتواصل معكم أحد ممثلي خدمة العملاء للرد على استفساركم ومساعدتكم بأعلى معايير الاهتمام والجودة.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:16px 40px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>

          <!-- English Greeting -->
          <tr>
            <td style="padding:16px 40px 8px;direction:ltr;text-align:left;">
              <p style="margin:0 0 10px;font-size:13px;color:#111111;font-weight:600;">Dear ${clientName},</p>
              <p style="margin:0 0 10px;font-size:12px;color:#555555;line-height:1.7;">
                Thank you for reaching out to <strong>VB FITS STUDIOS</strong>. Your inquiry has been successfully received by our concierge team. A dedicated client advisor will review your message and respond within <strong>24 business hours</strong>.
              </p>
            </td>
          </tr>

          <!-- Echo Original Message -->
          <tr>
            <td style="padding:16px 40px 24px;">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">
                Your Inquiry / نص رسالتكم
              </p>
              <div style="border-left:3px solid #C9A96E;padding:16px 20px;background:#FAFAF8;">
                <p style="margin:0;font-size:12px;color:#555555;line-height:1.8;font-style:italic;">${safeMessage}</p>
              </div>
            </td>
          </tr>

          <!-- Brand Commitment Strip -->
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:#111111;padding:20px 28px;text-align:center;">
                <p style="margin:0;font-size:10px;color:#C9A96E;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">
                  Our Commitment
                </p>
                <p style="margin:8px 0 0;font-size:11px;color:#AAAAAA;line-height:1.7;">
                  Every client is attended to with the same care and precision<br/>
                  we put into every stitch of our garments.
                </p>
              </div>
            </td>
          </tr>

          <!-- Direct Assistance Link -->
          <tr>
            <td style="padding:0 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.15em;">
                Direct Concierge Email / للتواصل المباشر
              </p>
              <a href="mailto:vbfitsstudios@gmail.com" style="font-size:12px;color:#111111;font-weight:600;text-decoration:underline;">
                vbfitsstudios@gmail.com
              </a>
            </td>
          </tr>

          <!-- CTA to Store -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="https://vbfitsstudios.com"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 40px;border:1px solid #111111;">
                Explore Collection / زيارة المتجر
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F5;padding:24px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:9px;color:#999999;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                © 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.
              </p>
            </td>
          </tr>

          <!-- Gold Bottom Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
