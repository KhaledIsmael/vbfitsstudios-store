/**
 * Unified Email Templates for VB FITS STUDIOS
 * Minimalist, high-end fashion atelier design.
 *
 * Exports:
 *  - buildBrandEmailHtml          → generic transactional (orders, returns, etc.)
 *  - buildBrandNotificationHtml   → luxury admin alert for new contact inquiry (→ brand owner)
 *  - buildAutoReplyHtml           → elegant auto-reply sent to the client (→ customer)
 */

export interface EmailParams {
  subject: string;
  headline: string;
  previewText?: string;
  customerName: string;
  bodyText: string[];
  detailsBox?: {
    title: string;
    items: { label: string; value: string }[];
  };
  callToAction?: {
    text: string;
    url: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERIC TRANSACTIONAL (orders, returns, refunds, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export function buildBrandEmailHtml(params: EmailParams): string {
  const { subject, headline, previewText, customerName, bodyText, detailsBox, callToAction } = params;

  const previewHtml = previewText
    ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>`
    : '';

  const bodyHtml = bodyText
    .map(p => `<p style="margin:0 0 16px;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">${p}</p>`)
    .join('');

  const detailsHtml = detailsBox
    ? `
      <tr>
        <td style="padding:20px 40px;text-align:center;">
          <div style="background:#F9F9F9;border:1px solid #EAEAEA;padding:24px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.15em;">${detailsBox.title}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#111111;text-align:left;">
              ${detailsBox.items.map(item => `
                <tr>
                  <td style="padding-bottom:10px;font-weight:500;">${item.label}</td>
                  <td style="padding-bottom:10px;text-align:right;"><strong>${item.value}</strong></td>
                </tr>
              `).join('')}
            </table>
          </div>
        </td>
      </tr>
    `
    : '';

  const ctaHtml = callToAction
    ? `
      <tr>
        <td style="padding:24px 40px;text-align:center;">
          <a href="${callToAction.url}"
             style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;
                    font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
                    padding:16px 40px;border:1px solid #111111;">
            ${callToAction.text}
          </a>
        </td>
      </tr>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${previewHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:#FFFFFF;letter-spacing:0.3em;text-transform:uppercase;">VB FITS STUDIOS</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:48px 40px 16px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">
                ${headline}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 16px;text-align:center;">
              <p style="margin:0 0 16px;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">
                Hi ${customerName},
              </p>
              ${bodyHtml}
            </td>
          </tr>

          ${detailsHtml}
          ${ctaHtml}

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F5;padding:32px 40px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                © 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.
              </p>
              <p style="margin:12px 0 0;font-size:10px;color:#BBBBBB;line-height:1.6;">
                This email was sent to you because of your interaction with our atelier.<br/>
                If you need assistance, simply reply to this email.
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


// ─────────────────────────────────────────────────────────────────────────────
// 2. BRAND NOTIFICATION → sent to vbfitsstudios@gmail.com
//    Luxury dark-accented email alerting the owner of a new client inquiry.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactNotificationParams {
  clientName: string;
  clientEmail: string;
  messageText: string;
  submittedAt?: string;
}

export function buildBrandNotificationHtml(params: ContactNotificationParams): string {
  const { clientName, clientEmail, messageText, submittedAt } = params;
  const timestamp = submittedAt || new Date().toUTCString();

  const escapedMessage = messageText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Client Inquiry — VB FITS STUDIOS</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:#F2F2F2;line-height:1px;max-height:0;overflow:hidden;">
    New inquiry from ${clientName} · ${clientEmail}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #DEDEDE;">

          <!-- Gold Top Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:28px 44px 24px;text-align:center;">
              <span style="font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#AAAAAA;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge &nbsp;·&nbsp; Admin Notification</span>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding:36px 44px 0;text-align:center;">
              <div style="display:inline-block;background:#111111;padding:8px 22px;">
                <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;font-weight:700;">● &nbsp; New Inquiry Received</span>
              </div>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:20px 44px 8px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">A client has submitted a transmission</h1>
              <p style="margin:12px 0 0;font-size:13px;color:#777777;line-height:1.6;">Review the inquiry details below and reply directly from your inbox.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:24px 44px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>

          <!-- Client Details -->
          <tr>
            <td style="padding:28px 44px;">
              <div style="background:#F9F9F9;border:1px solid #E8E8E8;padding:28px 32px;">
                <p style="margin:0 0 20px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Transmission Telemetry</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:14px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;width:40%;">Client Name</td>
                    <td style="padding-bottom:14px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:14px;font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;">Client Email</td>
                    <td style="padding-bottom:14px;font-size:13px;text-align:right;">
                      <a href="mailto:${clientEmail}" style="color:#111111;font-weight:600;text-decoration:underline;">${clientEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#888888;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;">Received At</td>
                    <td style="font-size:12px;color:#555555;text-align:right;">${timestamp}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 44px 32px;">
              <div style="border-left:3px solid #111111;padding:20px 24px;background:#FAFAFA;">
                <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.2em;">Message Content</p>
                <p style="margin:0;font-size:13px;color:#333333;line-height:1.8;">${escapedMessage}</p>
              </div>
            </td>
          </tr>

          <!-- CTAs -->
          <tr>
            <td style="padding:0 44px 40px;text-align:center;">
              <a href="https://vbfitsstudios.com/admin"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:15px 32px;border:1px solid #111111;">
                Admin Dashboard
              </a>
              &nbsp;&nbsp;
              <a href="mailto:${clientEmail}?subject=Re%3A%20Your%20Inquiry%20%E2%80%94%20VB%20FITS%20STUDIOS"
                 style="display:inline-block;background:#FFFFFF;color:#111111;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:15px 32px;border:1px solid #111111;">
                Reply to Client
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111111;padding:24px 44px;text-align:center;">
              <p style="margin:0;font-size:9px;color:#666666;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS — INTERNAL NOTIFICATION</p>
              <p style="margin:8px 0 0;font-size:9px;color:#555555;line-height:1.6;">
                Auto-generated by your store concierge system.<br/>
                To reply to the client, click "Reply to Client" above or reply to this email directly.
              </p>
            </td>
          </tr>

          <!-- Gold Bottom Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. CLIENT AUTO-REPLY → sent to the customer who submitted the form
//    Warm, premium confirmation with their original message echoed back.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoReplyParams {
  clientName: string;
  clientEmail: string;
  originalMessage: string;
}

export function buildAutoReplyHtml(params: AutoReplyParams): string {
  const { clientName, originalMessage } = params;

  const escapedMessage = originalMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>We received your message — VB FITS STUDIOS</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:#F5F4F2;line-height:1px;max-height:0;overflow:hidden;">
    Thank you for reaching out, ${clientName}. Your message has been received.
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F2;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">

          <!-- Gold Top Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 44px;text-align:center;">
              <span style="font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:0.35em;text-transform:uppercase;">VB FITS STUDIOS</span><br/>
              <span style="font-size:9px;color:#C9A96E;letter-spacing:0.25em;text-transform:uppercase;margin-top:6px;display:block;">Client Concierge</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:52px 44px 20px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:300;color:#111111;letter-spacing:0.05em;line-height:1.4;">Your message has been received.</h1>
              <div style="width:40px;height:1px;background:#C9A96E;margin:24px auto 0;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 44px 8px;">
              <p style="margin:0 0 14px;font-size:14px;color:#111111;line-height:1.7;">Dear ${clientName},</p>
              <p style="margin:0 0 14px;font-size:13px;color:#555555;line-height:1.8;">
                Thank you for reaching out to <strong>VB FITS STUDIOS</strong>. We have successfully received your transmission and it has been forwarded to our concierge team for review.
              </p>
              <p style="margin:0 0 14px;font-size:13px;color:#555555;line-height:1.8;">
                A dedicated client advisor will personally review your inquiry and respond within <strong>24 business hours</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.8;">
                We appreciate your patience and look forward to assisting you.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:28px 44px 0;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>

          <!-- Original Message Echo -->
          <tr>
            <td style="padding:24px 44px 32px;">
              <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:#AAAAAA;text-transform:uppercase;letter-spacing:0.2em;">Your Inquiry</p>
              <div style="border-left:3px solid #C9A96E;padding:16px 20px;background:#FAFAF8;">
                <p style="margin:0;font-size:13px;color:#666666;line-height:1.8;font-style:italic;">${escapedMessage}</p>
              </div>
            </td>
          </tr>

          <!-- Commitment Strip -->
          <tr>
            <td style="padding:0 44px 32px;">
              <div style="background:#111111;padding:24px 32px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#C9A96E;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">Our Commitment</p>
                <p style="margin:10px 0 0;font-size:12px;color:#AAAAAA;line-height:1.7;">
                  Every client is attended to with the same care and precision<br/>
                  we put into every stitch of our garments.
                </p>
              </div>
            </td>
          </tr>

          <!-- Direct Contact -->
          <tr>
            <td style="padding:0 44px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:10px;color:#AAAAAA;text-transform:uppercase;letter-spacing:0.15em;">Can't wait? Reach us directly</p>
              <a href="mailto:vbfitsstudios@gmail.com" style="font-size:13px;color:#111111;font-weight:600;text-decoration:underline;">vbfitsstudios@gmail.com</a>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 44px 44px;text-align:center;">
              <a href="https://vbfitsstudios.com"
                 style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 44px;border:1px solid #111111;">
                Explore the Collection
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F8F6;padding:28px 44px;text-align:center;border-top:1px solid #EAEAEA;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">© 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.</p>
              <p style="margin:10px 0 0;font-size:10px;color:#BBBBBB;line-height:1.6;">
                You received this because you submitted an inquiry through our website.<br/>
                Please do not reply to this automated confirmation — use the links above to reach us directly.
              </p>
            </td>
          </tr>

          <!-- Gold Bottom Bar -->
          <tr><td style="background:#C9A96E;height:3px;font-size:0;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


export interface EmailParams {
  subject: string;
  headline: string;
  previewText?: string;
  customerName: string;
  bodyText: string[]; // paragraphs
  detailsBox?: {
    title: string;
    items: { label: string; value: string }[];
  };
  callToAction?: {
    text: string;
    url: string;
  };
}

export function buildBrandEmailHtml(params: EmailParams): string {
  const { subject, headline, previewText, customerName, bodyText, detailsBox, callToAction } = params;

  const previewHtml = previewText
    ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>`
    : '';

  const bodyHtml = bodyText
    .map(p => `<p style="margin:0 0 16px;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">${p}</p>`)
    .join('');

  const detailsHtml = detailsBox
    ? `
      <tr>
        <td style="padding:20px 40px;text-align:center;">
          <div style="background:#F9F9F9;border:1px solid #EAEAEA;padding:24px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.15em;">${detailsBox.title}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#111111;text-align:left;">
              ${detailsBox.items.map(item => `
                <tr>
                  <td style="padding-bottom:10px;font-weight:500;">${item.label}</td>
                  <td style="padding-bottom:10px;text-align:right;"><strong>${item.value}</strong></td>
                </tr>
              `).join('')}
            </table>
          </div>
        </td>
      </tr>
    `
    : '';

  const ctaHtml = callToAction
    ? `
      <tr>
        <td style="padding:24px 40px;text-align:center;">
          <a href="${callToAction.url}"
             style="display:inline-block;background:#111111;color:#FFFFFF;text-decoration:none;
                    font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
                    padding:16px 40px;border:1px solid #111111;transition: opacity 0.3s ease;">
            ${callToAction.text}
          </a>
        </td>
      </tr>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${previewHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:32px 40px;text-align:center;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:#FFFFFF;letter-spacing:0.3em;text-transform:uppercase;">VB FITS STUDIOS</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:48px 40px 16px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:300;color:#111111;letter-spacing:0.04em;line-height:1.4;">
                ${headline}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 16px;text-align:center;">
              <p style="margin:0 0 16px;font-size:13px;color:#555555;line-height:1.7;letter-spacing:0.02em;">
                Hi ${customerName},
              </p>
              ${bodyHtml}
            </td>
          </tr>

          ${detailsHtml}
          ${ctaHtml}

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F5;padding:32px 40px;text-align:center;border-top:1px solid #EAEAEA;margin-top:16px;">
              <p style="margin:0;font-size:10px;color:#AAAAAA;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                © 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.
              </p>
              <p style="margin:12px 0 0;font-size:10px;color:#BBBBBB;line-height:1.6;">
                This email was sent to you because of your interaction with our atelier.<br/>
                If you need assistance, simply reply to this email.
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
