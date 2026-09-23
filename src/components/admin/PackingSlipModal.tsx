import React from 'react';
import { AdminOrder } from '../../lib/adminOrders';
import { Printer, X, Check, Truck, MapPin, Phone } from 'lucide-react';

interface PackingSlipModalProps {
  order: AdminOrder;
  onClose: () => void;
}

export const PackingSlipModal: React.FC<PackingSlipModalProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const isCOD =
    order.payment_method === 'COD' ||
    order.payment_method === 'cash_on_delivery' ||
    order.payment_status === 'pending_collection';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto">
      {/* Inject print-specific styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-packing-slip, #printable-packing-slip * {
            visibility: visible !important;
          }
          #printable-packing-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1.2cm;
          }
        }
      `}</style>

      {/* Main Modal Wrapper */}
      <div className="bg-[#151519] border border-white/20 max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl relative rounded-sm">
        {/* NON-PRINTABLE TOP ACTION BAR */}
        <div className="no-print h-14 px-6 border-b border-white/10 flex items-center justify-between bg-[#101014]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              جاهز للطباعة وتسليم المندوب
            </span>
            <span className="text-xs text-white/50 font-mono hidden sm:inline">
              طلب #{order.order_number}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2 text-xs font-bold rounded-sm transition-colors shadow"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة بوليصة الشحن والفاتورة (Print)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE SLIP BODY (Bilingual High Contrast Black on White) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-black">
          <div id="printable-packing-slip" className="max-w-3xl mx-auto space-y-6 text-black bg-white select-text">
            {/* 1. Header with Brand & Order Meta */}
            <div className="border-b-2 border-black pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-widest leading-none">
                  VB FITS STUDIOS
                </h1>
                <p className="text-xs font-bold text-gray-700 mt-1">
                  بوليصة شحن وتوصيل وفاتورة طلب · Dispatch Manifest & Invoice
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cairo Atelier & Fulfillment Center, Egypt
                </p>
              </div>

              <div className="text-left sm:text-right font-mono">
                <span className="text-[10px] uppercase text-gray-500 block font-bold">رقم الأوردر / Order No</span>
                <span className="text-2xl font-bold text-black tracking-wider block">
                  {order.order_number}
                </span>
                <span className="text-xs text-gray-600 block mt-0.5">
                  التاريخ: {new Date(order.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>

            {/* 2. Payment Alert Badge */}
            <div
              className={`p-3.5 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                isCOD
                  ? 'border-black bg-yellow-50 text-black font-bold'
                  : 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">طريقة السداد:</span>
                <span className="text-sm">
                  {isCOD ? '💵 دفع عند الاستلام (كاش للمندوب)' : '💳 تم الدفع إلكترونياً بالكامل (مدفوع)'}
                </span>
              </div>

              <div className="text-sm font-mono font-bold">
                {isCOD ? (
                  <span>المبلغ المطلوب تحصيله من العميل: {order.total.toLocaleString()} ج.م</span>
                ) : (
                  <span className="text-emerald-700">المبلغ المحصل: 0.00 ج.م (خالص الدفع)</span>
                )}
              </div>
            </div>

            {/* 3. Shipping & Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Deliver To (العميل) */}
              <div className="border border-black p-4 text-xs space-y-1.5 bg-gray-50">
                <div className="flex items-center justify-between border-b border-gray-300 pb-1.5 mb-1.5">
                  <span className="font-bold text-gray-900">بيانات المستلم (العميل):</span>
                  <span className="text-[10px] text-gray-500 font-mono">RECIPIENT</span>
                </div>
                <p className="font-bold text-sm text-black">{order.customer_name}</p>
                <p className="font-mono text-xs font-bold text-gray-900" dir="ltr">
                  هاتف: {order.customer_phone || '-'}
                </p>
                <p className="text-gray-700 font-medium">
                  {((order.shipping_address as any)?.governorate || order.shipping_address?.state || 'المحافظة')}{' '}
                  - {order.shipping_address?.city || 'المدينة'}
                </p>
                <p className="text-gray-700 text-xs">
                  {order.shipping_address?.street_line1 ? `شارع: ${order.shipping_address.street_line1}` : ''}
                  {(order.shipping_address as any)?.building ? ` - عمارة: ${(order.shipping_address as any).building}` : ''}
                  {(order.shipping_address as any)?.apartment ? ` - شقة: ${(order.shipping_address as any).apartment}` : ''}
                </p>
                {(order.shipping_address as any)?.notes && (
                  <p className="text-[11px] font-bold text-amber-900 mt-1">
                    علامة مميزة: {(order.shipping_address as any).notes}
                  </p>
                )}
              </div>

              {/* Sender Details (الراسل) */}
              <div className="border border-gray-300 p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-1.5">
                  <span className="font-bold text-gray-900">بيانات الراسل (البراند):</span>
                  <span className="text-[10px] text-gray-500 font-mono">SENDER</span>
                </div>
                <p className="font-bold text-black">VB FITS STUDIOS</p>
                <p className="text-gray-600">خدمة العملاء: support@vbfits.com</p>
                <p className="text-gray-600">القاهرة، جمهورية مصر العربية</p>
                <p className="text-[10px] text-gray-500 pt-2 border-t border-gray-200">
                  سياسة الاسترجاع والاستبدال متاحة خلال 14 يوماً وفقاً للشروط المدونة على المتجر.
                </p>
              </div>
            </div>

            {/* 4. Order Items Table */}
            <div className="border border-black">
              <div className="bg-gray-100 p-2.5 font-bold text-xs border-b border-black flex justify-between">
                <span>القطع المطلوبة بالأوردر (Items Manifest)</span>
                <span className="font-mono">{order.items?.length || 1} قطعة</span>
              </div>

              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="p-2.5">الموديل</th>
                    <th className="p-2.5">المقاس</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-left">السعر</th>
                    <th className="p-2.5 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.items?.map((item, idx) => {
                    const price = item.unit_price || (item as any).price || 0;
                    return (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-black">{item.product_name}</td>
                        <td className="p-2.5 font-mono font-bold">{item.size}</td>
                        <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                        <td className="p-2.5 text-left font-mono">{price.toLocaleString()} ج.م</td>
                        <td className="p-2.5 text-left font-mono font-bold">
                          {(price * item.quantity).toLocaleString()} ج.م
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Total Row */}
              <div className="bg-gray-50 p-3 border-t-2 border-black flex items-center justify-between text-xs font-bold">
                <span className="text-sm">إجمالي الفاتورة المطلوب سدادها:</span>
                <span className="text-base font-mono font-black text-black">
                  {order.total.toLocaleString()} جنيه مصري
                </span>
              </div>
            </div>

            {/* 5. Courier Signature & Instructions */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-300 text-xs">
              <div className="border border-dashed border-gray-400 p-3">
                <p className="font-bold text-gray-700">توقيع واستلام العميل:</p>
                <div className="h-12" />
              </div>
              <div className="border border-dashed border-gray-400 p-3">
                <p className="font-bold text-gray-700">توقيع وخاتم مندوب الشحن:</p>
                <div className="h-12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
