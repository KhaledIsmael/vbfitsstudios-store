import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { buildBrandEmailHtml } from './resend-templates';

/**
 * POST /api/email/dispatch
 *
 * Single endpoint to handle ALL transactional emails using Resend.
 * Connects to Supabase to log emails and prevent duplicates.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendApiKey = process.env.RESEND_API_KEY || '';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing environment variables.' });
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { eventType, referenceId, recipientEmail, payload } = req.body || {};

  if (!eventType || !referenceId || !recipientEmail || !payload) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 1. Check for duplicate email dispatch
  const { data: existingLog } = await supabase
    .from('email_logs')
    .select('id, status')
    .eq('event_type', eventType)
    .eq('reference_id', referenceId)
    .single();

  if (existingLog && existingLog.status === 'sent') {
    return res.status(200).json({ success: true, message: 'Email already dispatched successfully.', skipped: true });
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

    case 'admin_notification':
      emailParams = {
        subject: `Admin Alert: ${payload.alertType}`,
        headline: payload.alertType,
        customerName: 'Admin',
        bodyText: [
          payload.message
        ],
        callToAction: {
          text: 'View Dashboard',
          url: `${process.env.VITE_APP_URL}/admin`
        }
      };
      break;

    default:
      return res.status(400).json({ error: 'Unsupported eventType' });
  }

  // 3. Dispatch Email via Resend
  const htmlContent = buildBrandEmailHtml(emailParams);

  try {
    const { data, error } = await resend.emails.send({
      from: 'VB FITS STUDIOS <noreply@vbfitsstudios.com>',
      to: [recipientEmail],
      subject: emailParams.subject,
      html: htmlContent
    });

    if (error) {
      console.error('Resend Error:', error);
      // Log failure
      await supabase.from('email_logs').insert({
        event_type: eventType,
        reference_id: referenceId,
        recipient_email: recipientEmail,
        status: 'failed',
        error_details: JSON.stringify(error)
      });
      return res.status(502).json({ error: 'Email delivery failed' });
    }

    // Log success
    await supabase.from('email_logs').insert({
      event_type: eventType,
      reference_id: referenceId,
      recipient_email: recipientEmail,
      status: 'sent'
    });

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('Dispatch error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
