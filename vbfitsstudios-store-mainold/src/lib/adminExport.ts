/**
 * Admin Export Utility for VB FITS STUDIOS
 * 100% Free, zero-dependency Excel (.csv with UTF-8 BOM) and printable PDF Invoices/Reports.
 */

import { AdminOrder } from './adminOrders';
import { AdminProduct } from './adminProducts';

/**
 * Helper to download CSV file with UTF-8 BOM so Microsoft Excel renders Arabic
 * characters, governorates, and customer names cleanly without question marks or mojibake.
 */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const formatCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(formatCell).join(','),
    ...rows.map((row) => row.map(formatCell).join(','))
  ].join('\r\n');

  // \uFEFF is the UTF-8 Byte Order Mark for Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export orders list to Excel with complete customer and shipping details in Egyptian Arabic
 */
export function exportOrdersToExcel(orders: AdminOrder[]) {
  const headers = [
    'رقم الطلب',
    'تاريخ الطلب',
    'اسم العميل',
    'رقم الهاتف',
    'البريد الإلكتروني',
    'المحافظة',
    'المدينة / الحي',
    'تفاصيل العنوان',
    'العمارة / الدور / الشقة',
    'القطع والمقاسات المطلوبة',
    'طريقة الدفع',
    'حالة الدفع',
    'حالة الطلب',
    'كود الخصم',
    'قيمة الخصم (ج.م)',
    'مصاريف الشحن (ج.م)',
    'إجمالي الطلب (ج.م)'
  ];

  const rows = orders.map((o) => {
    const itemsSummary = (o.items || [])
      .map((item) => `${item.product_name} (مقاس: ${item.size || 'حر'} - كمية: ${item.quantity})`)
      .join(' | ');

    const dateStr = o.created_at
      ? new Date(o.created_at).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : '';

    const addr = (o.shipping_address as any) || {};

    const addressBuilding = [
      addr.building ? `عمارة: ${addr.building}` : '',
      addr.floor ? `دور: ${addr.floor}` : '',
      addr.apartment ? `شقة: ${addr.apartment}` : ''
    ]
      .filter(Boolean)
      .join(' - ');

    const gov = (o as any).governorate || addr.governorate || addr.state || 'القاهرة';
    const shippingFee = (o as any).shipping_fee ?? o.shipping_amount ?? 0;
    const discountCode = (o as any).discount_code || 'بدون كود';

    return [
      o.order_number || o.id.slice(0, 8),
      dateStr,
      o.customer_name || 'عميل المتجر',
      o.customer_phone || '',
      o.customer_email || '',
      gov,
      addr.city || '',
      addr.street_line1 || addr.street_address || '',
      addressBuilding,
      itemsSummary,
      o.payment_method === 'COD' || o.payment_method === 'cash_on_delivery' ? 'الدفع عند الاستلام (COD)' : 'بطاقة بنكية / محفظة',
      o.payment_status === 'paid' ? 'تم الدفع' : 'معلق / تحصيل عند الاستلام',
      translateStatus(o.status),
      discountCode,
      o.discount_amount || 0,
      shippingFee,
      o.total || 0
    ];
  });

  downloadCsv('vbfits_orders_report', headers, rows);
}

/**
 * Export products catalog to Excel
 */
export function exportProductsToExcel(products: AdminProduct[]) {
  const headers = [
    'اسم المنتج',
    'الرابط المباشر (Slug)',
    'القسم',
    'الكولكشن',
    'السعر بالجنيه (EGP)',
    'تفاصيل المقاسات والمخزون',
    'إجمالي الكمية بالمخزن',
    'مميز على الرئيسية',
    'حالة النشر'
  ];

  const rows = products.map((p) => {
    const variantsSummary = (p.variants || [])
      .map((v) => `${v.size}: ${v.stock} قطعة`)
      .join(' | ');

    const totalStock = (p.variants || []).reduce((acc, v) => acc + (v.stock || 0), 0);

    return [
      p.name,
      p.slug,
      p.category?.name || 'عام',
      p.collection_tag || 'all',
      p.price,
      variantsSummary || 'لا توجد مقاسات محددة',
      totalStock,
      p.featured ? 'نعم' : 'لا',
      p.is_published ? 'منشور للبيع' : 'مسودة'
    ];
  });

  downloadCsv('vbfits_products_catalog', headers, rows);
}

/**
 * Translate internal order status to clear Egyptian Arabic
 */
function translateStatus(s: string): string {
  switch (s?.toLowerCase()) {
    case 'placed':
    case 'pending':
      return 'طلب جديد (قيد المراجعة)';
    case 'confirmed':
    case 'packed':
    case 'processing':
      return 'تم التجهيز والتغليف';
    case 'shipped':
    case 'in_transit':
    case 'out_for_delivery':
      return 'مع شركة الشحن للتوصيل';
    case 'delivered':
      return 'تم التوصيل للعميل';
    case 'cancelled':
      return 'ملغي';
    case 'refunded':
      return 'مرتجع ومسترد';
    default:
      return s || 'قيد المراجعة';
  }
}

/**
 * Generate and open a professional, printable branded PDF invoice / packing slip
 * with high-res typography, official logo, Egyptian governorate routing, and QR styling.
 */
export function printOrderInvoice(order: AdminOrder) {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) لمعاينة وطباعة الفاتورة كـ PDF.');
    return;
  }

  const itemsHtml = (order.items || [])
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">
          ${item.product_name}
          <div style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px;">
            المقاس: <b style="color: #0f172a;">${item.size || 'One Size'}</b> ${item.color ? `· اللون: ${item.color}` : ''}
          </div>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace;">${(item.unit_price || (item as any).price || 0).toLocaleString()} ج.م</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: bold; font-family: monospace;">${((item.unit_price || (item as any).price || 0) * (item.quantity || 1)).toLocaleString()} ج.م</td>
      </tr>
    `
    )
    .join('');

  const addr = (order.shipping_address as any) || {};
  const dateFormatted = order.created_at
    ? new Date(order.created_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('ar-EG');

  const gov = (order as any).governorate || addr.governorate || addr.state || 'القاهرة';
  const shippingFee = (order as any).shipping_fee ?? order.shipping_amount ?? 0;
  const discountCode = (order as any).discount_code || 'كوبون';

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>فاتورة وبوليصة طلب #${order.order_number || order.id.slice(0, 8)} - VB FITS STUDIOS</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Alexandria', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #ffffff;
          color: #0f172a;
          padding: 30px;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .brand-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #0f172a;
        }
        .brand-sub {
          font-size: 11px;
          color: #d97706;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .invoice-badge {
          background: #0f172a;
          color: #ffffff;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: bold;
          border-radius: 4px;
          text-align: left;
        }
        .grid-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 25px;
        }
        .info-col h3 {
          font-size: 12px;
          color: #64748b;
          font-weight: bold;
          margin-bottom: 6px;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 4px;
        }
        .info-col p {
          margin-bottom: 4px;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 700;
          font-size: 11px;
          padding: 10px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 2px solid #cbd5e1;
        }
        .totals-card {
          margin-right: auto;
          width: 280px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 30px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12px;
        }
        .total-final {
          border-top: 2px solid #0f172a;
          margin-top: 6px;
          padding-top: 8px;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .footer-note {
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
          font-size: 11px;
          color: #64748b;
          text-align: center;
          line-height: 1.6;
        }
        .print-btn {
          position: fixed;
          top: 20px;
          left: 20px;
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 10px 18px;
          font-family: inherit;
          font-weight: bold;
          font-size: 13px;
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        @media print {
          .print-btn { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">طباعة الفاتورة / حفظ كـ PDF</button>

      <div class="header">
        <div>
          <div class="brand-title">VB FITS STUDIOS</div>
          <div class="brand-sub">Luxury Streetwear & Atelier Core · Egypt</div>
          <p style="color: #64748b; font-size: 11px; margin-top: 4px;">الموقع الإلكتروني: vbfitsstudios.com</p>
        </div>
        <div>
          <div class="invoice-badge">بوليصة وفاتورة شحن</div>
          <p style="font-size: 11px; margin-top: 6px; color: #475569; text-align: left;">رقم الطلب: <b>#${order.order_number || order.id.slice(0, 8)}</b></p>
          <p style="font-size: 11px; color: #64748b; text-align: left;">التاريخ: ${dateFormatted}</p>
        </div>
      </div>

      <div class="grid-info">
        <div class="info-col">
          <h3>بيانات العميل والشحن في مصر</h3>
          <p><b>الاسم:</b> ${order.customer_name || 'عميل المتجر'}</p>
          <p><b>رقم التليفون:</b> <span dir="ltr">${order.customer_phone || 'غير مسجل'}</span></p>
          <p><b>المحافظة:</b> ${gov}</p>
          <p><b>العنوان:</b> ${addr.street_line1 || addr.street_address || 'العنوان الرئيسي'}</p>
          ${
            addr.building || addr.floor || addr.apartment
              ? `<p><b>تفاصيل المبنى:</b> عمارة ${addr.building || '-'} · دور ${addr.floor || '-'} · شقة ${addr.apartment || '-'}</p>`
              : ''
          }
          ${addr.landmark ? `<p><b>علامة مميزة:</b> ${addr.landmark}</p>` : ''}
        </div>
        <div class="info-col">
          <h3>تفاصيل الدفع والتسليم</h3>
          <p><b>طريقة الدفع:</b> ${order.payment_method === 'COD' || order.payment_method === 'cash_on_delivery' ? 'الدفع نقدياً عند الاستلام (COD)' : 'دفع إلكتروني مسبق'}</p>
          <p><b>حالة الدفع:</b> <b style="color: ${order.payment_status === 'paid' ? '#059669' : '#d97706'};">${order.payment_status === 'paid' ? 'مدفوع بالكامل' : 'تحصيل المبلغ من العميل عند التسليم'}</b></p>
          <p><b>حالة الطلب:</b> ${translateStatus(order.status)}</p>
          ${order.tracking_number ? `<p><b>رقم البوليصة:</b> ${order.tracking_number}</p>` : ''}
          ${order.notes ? `<p style="background: #fff; padding: 4px; border: 1px solid #e2e8f0; margin-top: 4px;"><b>ملاحظات العميل:</b> ${order.notes}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="text-align: right;">المنتج والمواصفات</th>
            <th style="width: 70px; text-align: center;">الكمية</th>
            <th style="width: 110px; text-align: left;">سعر القطعة</th>
            <th style="width: 120px; text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center; padding: 20px;">لا توجد عناصر</td></tr>'}
        </tbody>
      </table>

      <div class="totals-card">
        <div class="totals-row">
          <span style="color: #64748b;">المجموع الفرعي:</span>
          <span style="font-family: monospace;">${((order.subtotal || order.total || 0) - shippingFee + (order.discount_amount || 0)).toLocaleString()} ج.م</span>
        </div>
        ${
          order.discount_amount && order.discount_amount > 0
            ? `
          <div class="totals-row" style="color: #059669;">
            <span>خصم (${discountCode}):</span>
            <span style="font-family: monospace;">- ${Number(order.discount_amount).toLocaleString()} ج.م</span>
          </div>
        `
            : ''
        }
        <div class="totals-row">
          <span style="color: #64748b;">مصاريف الشحن:</span>
          <span style="font-family: monospace;">${shippingFee > 0 ? `${shippingFee} ج.م` : 'شحن مجاني'}</span>
        </div>
        <div class="totals-row total-final">
          <span>المطلوب تحصيله:</span>
          <span>${(order.total || 0).toLocaleString()} ج.م</span>
        </div>
      </div>

      <div class="footer-note">
        <p>شكراً لطلبك من <b>VB FITS STUDIOS</b>. نسعى دائماً لتقديم أعلى خامات الملابس العصرية وأفضل تجربة لعملائنا في مصر.</p>
        <p style="margin-top: 4px;">للاستبدال أو الاسترجاع خلال 14 يوماً بشرط الحفاظ على القطعة والتاغ بحالتها الأصلية.</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
