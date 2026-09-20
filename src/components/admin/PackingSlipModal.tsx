import React from 'react';
import { AdminOrder } from '../../lib/adminOrders';
import { Printer, X, Check, ShieldCheck, Truck } from 'lucide-react';

interface PackingSlipModalProps {
  order: AdminOrder;
  onClose: () => void;
}

export const PackingSlipModal: React.FC<PackingSlipModalProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const isCOD = order.payment_method === 'cash_on_delivery';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Inject print-specific styling */}
      <style>{`
        @media print {
          /* Hide everything in the page except the printable slip */
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
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* Main Modal Wrapper */}
      <div className="bg-[#151519] border border-white/20 max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl relative">
        {/* NON-PRINTABLE TOP ACTION BAR */}
        <div className="no-print h-14 px-6 border-b border-white/10 flex items-center justify-between bg-[#101014]">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              ● Ready for Courier Dispatch
            </span>
            <span className="text-xs text-white/40 font-mono hidden sm:inline">
              Order #{order.order_number}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold transition-colors shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip & Label</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE SLIP BODY (Pure Black on White Typography) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-black">
          <div id="printable-packing-slip" className="max-w-3xl mx-auto space-y-8 text-black bg-white select-text">
            {/* 1. Header with Brand & Order Meta */}
            <div className="border-b-2 border-black pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-widest leading-none">
                  VB FITS STUDIOS
                </h1>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mt-1">
                  Atelier Dispatch & Logistics · Ready-to-Wear Archive
                </p>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  Zamalek Atelier Hub, Cairo · New York Hub
                </p>
              </div>

              <div className="text-left sm:text-right font-mono">
                <span className="text-[10px] uppercase text-gray-500 block">Manifest Number</span>
                <span className="text-xl font-bold text-black tracking-wider block">
                  {order.order_number}
                </span>
                <span className="text-xs text-gray-600 block mt-1">
                  Date: {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                {order.tracking_number && (
                  <span className="text-xs text-gray-800 font-semibold block mt-0.5">
                    AWB: {order.tracking_number}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Payment Alert Badge */}
            <div className={`p-3 border-2 flex items-center justify-between font-mono text-xs ${
              isCOD
                ? 'border-black bg-gray-100 font-bold'
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-widest text-[10px]">Payment Settlement:</span>
                <span className="uppercase font-bold">
                  {isCOD ? 'CASH ON DELIVERY (COD)' : 'PREPAID VIA CREDIT CARD (PAID IN FULL)'}
                </span>
              </div>
              <div>
                <span className="uppercase text-[11px]">
                  {isCOD ? `COLLECT FROM RECIPIENT: $${order.total.toFixed(2)}` : 'AMOUNT DUE: $0.00'}
                </span>
              </div>
            </div>

            {/* 3. Shipping & Sender Address Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Deliver To */}
              <div className="border border-black p-4 font-mono text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-2 border-b border-gray-200 pb-1">
                  SHIP TO RECIPIENT
                </span>
                <p className="font-bold text-sm text-black">{order.customer_name}</p>
                <p>{order.shipping_address?.street_line1}</p>
                {order.shipping_address?.street_line2 && <p>{order.shipping_address.street_line2}</p>}
                <p>
                  {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}
                </p>
                <p className="uppercase">{order.shipping_address?.country}</p>
                <p className="pt-2 font-bold text-black">Tel: {order.customer_phone}</p>
              </div>

              {/* Shipped From */}
              <div className="border border-gray-300 p-4 font-mono text-xs space-y-1 text-gray-700">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-2 border-b border-gray-200 pb-1">
                  DISPATCH ATELIER SENDER
                </span>
                <p className="font-bold text-sm text-black">VB Fits Studios Dispatch</p>
                <p>14 Gezira Island Atelier Dock</p>
                <p>Zamalek, Cairo 11211</p>
                <p>Egypt</p>
                <p className="pt-2 text-gray-600">Email: concierge@vbfitsstudios.com</p>
              </div>
            </div>

            {/* 4. Garments Item Breakdown Table */}
            <div className="pt-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono font-bold block mb-2">
                Garments Manifest ({order.items.length} Items)
              </span>
              <table className="w-full text-left text-xs border border-black font-mono">
                <thead>
                  <tr className="border-b border-black bg-gray-100 text-black uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Item #</th>
                    <th className="py-2.5 px-3">Silhouette Name</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Colorway</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-black">
                  {order.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold">{item.product_name}</td>
                      <td className="py-2.5 px-3 font-bold">{item.size}</td>
                      <td className="py-2.5 px-3">{item.color}</td>
                      <td className="py-2.5 px-3 text-gray-600">{item.sku}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right">${item.unit_price.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">${item.total_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5. Financial Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-64 border border-black p-3 font-mono text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Discount:</span>
                    <span>-${order.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Delivery:</span>
                  <span>{order.shipping_amount === 0 ? 'Complimentary' : `$${order.shipping_amount.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between border-t border-black pt-1.5 font-bold text-sm text-black">
                  <span>Grand Total:</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 6. Inspection & Return Policy Notice */}
            <div className="border-t-2 border-black pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[11px] font-mono text-gray-700">
              <div className="border border-dashed border-gray-400 p-4 flex flex-col justify-between h-28">
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">
                  Quality & Packaging Inspection Stamp
                </span>
                <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                  <span>Inspected by Atelier Staff:</span>
                  <span className="font-serif italic text-black">VB QA-4</span>
                </div>
                <span className="text-[9px] text-gray-400">Garment carefully pressed, boxed, and sealed.</span>
              </div>

              <div className="p-2 space-y-1">
                <p className="font-bold text-black uppercase text-[10px]">14-Day Returns & Exchanges</p>
                <p className="text-gray-600 leading-relaxed text-[10px]">
                  All garments may be returned or exchanged within 14 days of delivery provided security tags remain affixed and packaging intact. Initiate at vbfitsstudios.com/track-order or contact concierge@vbfitsstudios.com.
                </p>
              </div>
            </div>

            {/* Barcode visual placeholder */}
            <div className="text-center pt-2 font-mono text-xs text-gray-400 tracking-widest">
              <div className="h-10 max-w-xs mx-auto border-y border-black flex items-center justify-center font-bold tracking-widest text-black">
                ||| | |||| | ||| ||||| || ||| | ||||
              </div>
              <span className="text-[9px] mt-1 block">*{order.order_number}*</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
