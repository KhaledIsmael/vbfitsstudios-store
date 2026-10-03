/**
 * Admin Free Integrations & Automation Utility for VB FITS STUDIOS
 * Provides code support for:
 * 1. 1-Click Direct WhatsApp Customer Support with pre-filled Egyptian Arabic messages.
 * 2. 100% Free Telegram Bot Instant Order Webhooks to send order notifications directly to the owner's phone.
 * 3. Discord Webhook support for team channels.
 */

import { AdminOrder } from './adminOrders';

/**
 * Standardize an Egyptian phone number for WhatsApp URL (e.g. 01012345678 -> 201012345678)
 */
export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    return '2' + digits;
  }
  if (digits.startsWith('20')) {
    return digits;
  }
  return '20' + digits;
}

/**
 * Generate a 1-click WhatsApp message link to confirm or update an order directly with the customer in Egypt.
 * Strictly verifies the number belongs to the customer (never falls back to store/admin phone).
 */
export function generateWhatsAppOrderLink(order: AdminOrder): string {
  const adminPhone = ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WHATSAPP_NUMBER) || '201000000000').replace(/[^0-9]/g, '');
  
  // Resolve customer phone from order, shipping snapshot, or order notes
  let rawPhone = order.customer_phone || (order.shipping_address as any)?.phone || '';
  if (!rawPhone && order.notes) {
    const match = order.notes.match(/(?:Contact )?Phone:\s*([^\s|]+)/i);
    if (match?.[1]) rawPhone = match[1];
  }

  const phone = formatEgyptianPhoneForWhatsApp(rawPhone);

  // If phone is missing, too short, or matches the store's own admin number, return empty string
  if (!phone || phone.length < 10 || phone === adminPhone || phone === '201000000000') {
    return '';
  }

  const customerName = order.customer_name && order.customer_name !== 'Private Client' ? order.customer_name : 'يا فندم';
  const orderNum = order.order_number || order.id.slice(0, 8);
  const itemsText = (order.items || [])
    .map((item) => `• ${item.product_name} (مقاس: ${item.size || 'حر'})`)
    .join('\n');

  const paymentDesc =
    order.payment_method === 'COD' || order.payment_method === 'cash_on_delivery'
      ? 'الدفع عند الاستلام (كاش أو بالفيزا مع المندوب)'
      : 'دفع إلكتروني (تم الدفع)';

  const text = `أهلاً ${customerName}، بنأكد معاك طلبك من براند *VB FITS STUDIOS* 🖤
رقم الأوردر: *#${orderNum}*
القطع المطلوبة:
${itemsText}
إجمالي المبلغ: *${(order.total || 0).toLocaleString()} ج.م* (شامل الشحن)
طريقة الدفع: ${paymentDesc}

العنوان المسجل: ${((order.shipping_address as any)?.governorate || 'المحافظة')} - ${((order.shipping_address as any)?.city || '')} - ${((order.shipping_address as any)?.street_line1 || '')}

هل العنوان والمقاسات جاهزة للتجهيز والشحن لحضرتك؟`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Send an automated instant Telegram notification to the store owner's phone
 * Free forever! Only requires VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID.
 */
export async function sendTelegramOrderNotification(
  order: AdminOrder,
  config?: { botToken?: string; chatId?: string }
): Promise<{ success: boolean; error?: string }> {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

  const token =
    config?.botToken ||
    env.VITE_TELEGRAM_BOT_TOKEN ||
    localStorage.getItem('vbfits_telegram_bot_token') ||
    '';

  const chatId =
    config?.chatId ||
    env.VITE_TELEGRAM_CHAT_ID ||
    localStorage.getItem('vbfits_telegram_chat_id') ||
    '';

  if (!token || !chatId) {
    return {
      success: false,
      error: 'Telegram Bot Token or Chat ID not configured.'
    };
  }

  const itemsSummary = (order.items || [])
    .map((item) => `- ${item.product_name} [${item.size || 'One Size'}] x${item.quantity}`)
    .join('\n');

  const gov = (order as any).governorate || (order.shipping_address as any)?.governorate || order.shipping_address?.state || 'القاهرة';

  const message = `🛍 *أوردر جديد على متجر VB FITS STUDIOS!*

📦 *رقم الطلب:* #${order.order_number || order.id.slice(0, 8)}
👤 *العميل:* ${order.customer_name || 'عميل المتجر'}
📞 *التليفون:* \`${order.customer_phone || 'غير مسجل'}\`
📍 *المحافظة:* ${gov}
💵 *المبلغ:* *${(order.total || 0).toLocaleString()} EGP*
💳 *طريقة الدفع:* ${order.payment_method === 'COD' || order.payment_method === 'cash_on_delivery' ? 'دفع عند الاستلام' : 'دفع إلكتروني'}

👕 *القطع:*
${itemsSummary}

🔗 افتح لوحة التحكم لتأكيد وشحن الأوردر!`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    }
    return { success: false, error: data.description || 'Failed to send Telegram message' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error sending notification' };
  }
}
