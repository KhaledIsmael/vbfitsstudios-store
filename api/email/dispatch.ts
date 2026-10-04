import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { buildBrandEmailHtml, buildBrandNotificationHtml, buildAutoReplyHtml } from './resend-templates';

/**
 * POST /api/email/dispatch
 *
 * Single endpoint to handle ALL transactional emails using Resend.
 * Connects to Supabase to log emails and prevent duplicates.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!resendApiKey) {
    console.error('RESEND_API_KEY is missing in environment variables.');
    return res.status(500).json({ error: 'Missing RESEND_API_KEY environment variable.' });
  }

  const resend = new Resend(resendApiKey);
  const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

  const { eventType, referenceId, recipientEmail, payload } = req.body || {};

  if (!eventType || !referenceId || !recipientEmail || !payload) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 1. Check for duplicate email dispatch if database client is available
  if (supabase) {
    try {
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id, status')
        .eq('event_type', eventType)
        .eq('reference_id', referenceId)
        .maybeSingle();

      if (existingLog && existingLog.status === 'sent') {
        return res.status(200).json({ success: true, message: 'Email already dispatched successfully.', skipped: true });
      }
    } catch (e) {
      console.warn('email_logs duplicate check notice:', e);
    }
  }

  // 2. Build the email template based on the eventType
  let emailParams: any = null;

  switch (eventType) {
    case 'order_confirmation':
      emailParams = {
        subject: `Order Confirmation — ${payload.orderNumber}`,
        headline: 'Thank you for your order.',
        previewText: 'Your order has been received and is being processed.',
        customerName: payload.customerName || 'Valued Guest',
        bodyText: [
          'We have received your order and our atelier team is carefully preparing your pieces.',
          'You will receive another notification once your package has been dispatched.'
        ],
        detailsBox: {
          title: 'Order Details',
          items: [
            { label: 'Order Reference', value: payload.orderNumber },
            { label: 'Order Total', value: `EGP ${payload.total?.toFixed(2) || '0.00'}` }
          ]
        },
        callToAction: {
          text: 'View Order',
          url: `${process.env.VITE_APP_URL}/order-confirmation/${referenceId}`
        }
      };
      break;

    case 'order_status_update':
      emailParams = {
        subject: `Order Update — ${payload.statusLabel} · ${payload.orderNumber}`,
        headline: 'Your order status has changed.',
        customerName: payload.customerName || 'Valued Guest',
        bodyText: [
          `Your order status has been updated to: ${payload.statusLabel}.`,
          payload.statusMessage || 'Please check your order page for more details.'
        ],
        callToAction: {
          text: 'Track Order',
          url: `${process.env.VITE_APP_URL}/orders/${referenceId}/track`
        }
      };
      if (payload.trackingNumber) {
        emailParams.detailsBox = {
          title: 'Shipping Information',
          items: [{ label: 'Tracking Number', value: payload.trackingNumber }]
        };
      }
      break;

    case 'return_request_received':
      emailParams = {
        subject: `Return Request Received — ${payload.orderNumber}`,
        headline: 'Return Request Received.',
        customerName: payload.customerName || 'Valued Guest',
        bodyText: [
          'We have successfully received your return request.',
          'Our team will review it within 1–2 business days and notify you of the next steps.'
        ],
        detailsBox: {
          title: 'Request Details',
          items: [
            { label: 'Order Reference', value: payload.orderNumber },
            { label: 'Return Reason', value: payload.reason }
          ]
        }
      };
      break;

    case 'return_status_update':
      emailParams = {
        subject: `Return Update — ${payload.statusLabel} · ${payload.orderNumber}`,
        headline: `Return Request ${payload.statusLabel}.`,
        customerName: payload.customerName || 'Valued Guest',
        bodyText: [
          `The status of your return request has been updated to: ${payload.statusLabel}.`,
          payload.statusMessage || ''
        ]
      };
      break;

    case 'refund_completed':
      emailParams = {
        subject: `Refund Confirmation — ${payload.orderNumber}`,
        headline: 'Your refund has been dispatched.',
        customerName: payload.customerName || 'Valued Guest',
        bodyText: [
          `We have successfully processed a refund for your return on order ${payload.orderNumber}.`,
          'Please allow a few days for the funds to reflect in your account.'
        ],
        detailsBox: {
          title: 'Refund Details',
          items: [
            { label: 'Amount', value: `EGP ${payload.amount?.toFixed(2)}` },
            { label: 'Method', value: payload.method },
            { label: 'Transaction Ref', value: payload.transactionRef }
          ]
        }
      };
      break;

    case 'contact_inquiry_to_brand': {
      // Luxury brand-owner notification with telemetry + reply button
      const html = buildBrandNotificationHtml({
        clientName:   payload.clientName   || 'Unknown',
        clientEmail:  payload.clientEmail  || recipientEmail,
        messageText:  payload.message      || '',
        submittedAt:  new Date().toUTCString()
      });
      return await sendEmail(res, resend, supabase, {
        from:       process.env.RESEND_FROM_EMAIL || 'VB FITS STUDIOS <noreply@vbfitsstudios.com>',
        to:         [recipientEmail],
        reply_to:   payload.clientEmail,
        subject:    `[VB FITS] New inquiry from ${payload.clientName || 'a client'}`,
        html,
        eventType, referenceId, recipientEmail
      });
    }

    case 'contact_autoreply': {
      // Elegant gold-accented auto-reply to the client
      const html = buildAutoReplyHtml({
        clientName:      payload.clientName    || 'Valued Client',
        clientEmail:     recipientEmail,
        originalMessage: payload.message       || ''
      });
      return await sendEmail(res, resend, supabase, {
        from:    process.env.RESEND_FROM_EMAIL || 'VB FITS STUDIOS <noreply@vbfitsstudios.com>',
        to:      [recipientEmail],
        subject: 'Your Inquiry Has Been Received — VB FITS STUDIOS',
        html,
        eventType, referenceId, recipientEmail
      });
    }

    case 'admin_notification':
      emailParams = {
        subject: `Admin Alert: ${payload.alertType || 'Notification'}`,
        headline: payload.alertType || 'Admin Notification',
        customerName: 'Admin',
        bodyText: [payload.message || payload.messageText || ''],
        callToAction: {
          text: 'Open Admin Dashboard',
          url: `${process.env.VITE_APP_URL || 'https://vbfitsstudios.com'}/admin`
        }
      };
      break;

    default:
      return res.status(400).json({ error: 'Unsupported eventType' });
  }

  // 3. Dispatch generic transactional email via Resend
  const htmlContent = buildBrandEmailHtml(emailParams);

  return await sendEmail(res, resend, supabase, {
    from:    process.env.RESEND_FROM_EMAIL || 'VB FITS STUDIOS <noreply@vbfitsstudios.com>',
    to:      [recipientEmail],
    reply_to: payload.clientEmail || payload.replyTo || undefined,
    subject: emailParams.subject,
    html:    htmlContent,
    eventType, referenceId, recipientEmail
  });
}

// ─── Shared send helper (handles fallback + logging) ─────────────────────────

async function sendEmail(
  res: VercelResponse,
  resend: any,
  supabase: any,
  opts: {
    from: string;
    to: string[];
    reply_to?: string;
    subject: string;
    html: string;
    eventType: string;
    referenceId: string;
    recipientEmail: string;
  }
) {
  const { from, to, reply_to, subject, html, eventType, referenceId, recipientEmail } = opts;
  try {
    let sendResult = await resend.emails.send({ from, to, reply_to, subject, html });

    // Auto-fallback when sender domain is unverified in Resend
    if (sendResult.error && (
      sendResult.error.message?.toLowerCase().includes('not verified') ||
      sendResult.error.name === 'validation_error'
    )) {
      console.warn('Sender domain unverified in Resend, retrying with onboarding@resend.dev...');
      sendResult = await resend.emails.send({
        from: 'VB FITS STUDIOS <onboarding@resend.dev>',
        to, reply_to, subject, html
      });
    }

    if (sendResult.error) {
      console.error('Resend Error:', sendResult.error);
      if (supabase) {
        await supabase.from('email_logs').insert({
          event_type: eventType,
          reference_id: referenceId,
          recipient_email: recipientEmail,
          status: 'failed',
          error_details: JSON.stringify(sendResult.error)
        }).catch(() => {});
      }
      return res.status(502).json({
        error: 'Email delivery failed',
        details: sendResult.error.message,
        name: sendResult.error.name,
        resendHelp: sendResult.error.message?.toLowerCase().includes('not verified') ||
          sendResult.error.message?.toLowerCase().includes('testing email')
          ? 'Resend requires verifying the domain vbfitsstudios.com with DNS records before sending to external addresses.'
          : undefined
      });
    }

    if (supabase) {
      await supabase.from('email_logs').insert({
        event_type: eventType,
        reference_id: referenceId,
        recipient_email: recipientEmail,
        status: 'sent',
        provider_message_id: sendResult.data?.id
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, messageId: sendResult.data?.id });
  } catch (err: any) {
    console.error('Dispatch error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
