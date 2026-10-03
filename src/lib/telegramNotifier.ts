/**
 * Telegram Instant Order Notification Utility (100% Free Integration)
 * Sends instant push notifications to the store owner's Telegram whenever a new order is placed.
 */

interface TelegramOrderPayload {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  governorate?: string;
  city?: string;
  address?: string;
  items: Array<{ name: string; size?: string; quantity: number; price: number }>;
  total: number;
  paymentMethod?: string;
}

export async function sendTelegramOrderAlert(order: TelegramOrderPayload): Promise<boolean> {
  try {
    const token =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN) ||
      '';
    const chatId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_CHAT_ID) ||
      '';

    if (!token || !chatId) {
      // Not configured yet; silently skip without throwing
      return false;
    }

    const itemsList = order.items
      .map(
        (it) =>
          `• ${it.name} ${it.size ? `[مقاس: ${it.size}]` : ''} × ${it.quantity} (${it.price} EGP)`
      )
      .join('\n');

    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}` : '';

    const message = `
🛍️ <b>أوردر جديد في VB FITS STUDIOS!</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>رقم الطلب:</b> #${order.orderNumber}
👤 <b>العميل:</b> ${order.customerName}
📞 <b>الموبايل:</b> ${order.customerPhone} ${waLink ? `(<a href="${waLink}">محادثة واتساب</a>)` : ''}
📍 <b>المحافظة / العنوان:</b> ${order.governorate || ''} - ${order.city || ''} (${order.address || ''})
💳 <b>طريقة الدفع:</b> ${order.paymentMethod || 'الدفع عند الاستلام (COD)'}
━━━━━━━━━━━━━━━━━━━━
📦 <b>المنتجات:</b>
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💰 <b>المبلغ المطلوب تحصيله:</b> <b>${order.total.toLocaleString()} EGP</b>
`.trim();

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    return response.ok;
  } catch (err) {
    console.warn('Telegram notification notice:', err);
    return false;
  }
}
