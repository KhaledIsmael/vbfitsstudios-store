/**
 * Unified Email Templates for VB FITS STUDIOS
 * Minimalist, high-end fashion design.
 */

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
