import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminOrders,
  updateOrderStatus,
  updateOrderInternalNotes,
  issueOrderRefund,
  type AdminOrder,
  type AdminOrderItem,
  type AdminRefund
} from '../../lib/adminOrders';
import { PackingSlipModal } from '../../components/admin/PackingSlipModal';
import {
  Search,
  Filter,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  RotateCcw,
  Printer,
  Edit3,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  FileText,
  Save,
  Package,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Banknote
} from 'lucide-react';

type OrderStatusFilter = 'all' | 'unfulfilled' | 'shipped' | 'delivered' | 'refunded';

const PIPELINE_STAGES = [
  { key: 'placed', label: '1. Placed' },
  { key: 'confirmed', label: '2. Confirmed' },
  { key: 'packed', label: '3. Packed' },
  { key: 'shipped', label: '4. Shipped' },
  { key: 'out_for_delivery', label: '5. Out for Delivery' },
  { key: 'delivered', label: '6. Delivered' }
];

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');

  // Selected order for Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Packing slip modal
  const [packingSlipOrder, setPackingSlipOrder] = useState<AdminOrder | null>(null);

  // Internal notes form state in detail drawer
  const [internalNotesInput, setInternalNotesInput] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('Customer Return & Restock');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    const data = await fetchAdminOrders();
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Sync internal notes when selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      setInternalNotesInput(selectedOrder.internal_notes || '');
      setRefundAmount(selectedOrder.total);
    }
  }, [selectedOrder]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === 'unfulfilled' && !['placed', 'confirmed', 'packed', 'pending', 'processing'].includes(o.status)) return false;
      if (statusFilter === 'shipped' && !['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)) return false;
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;
      if (statusFilter === 'refunded' && !['refunded', 'cancelled'].includes(o.status)) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(q)) ||
        (o.shipping_address?.city && o.shipping_address.city.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, searchQuery]);

  // Aggregate summary stats
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const unfulfilledCount = orders.filter((o) =>
      ['placed', 'confirmed', 'packed', 'pending', 'processing'].includes(o.status)
    ).length;
    const inTransitCount = orders.filter((o) =>
      ['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)
    ).length;
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
    const refundedCount = orders.filter((o) => ['refunded', 'cancelled'].includes(o.status)).length;
    const grossVolume = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);

    return { totalCount, unfulfilledCount, inTransitCount, deliveredCount, refundedCount, grossVolume };
  }, [orders]);

  // ── 1. Update Order Status (Reflects live on Customer Tracking Timeline) ──
  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    const { error } = await updateOrderStatus(orderId, nextStatus);
    if (!error) {
      setOrders((prev) =>
        prev.map((item) => (item.id === orderId ? { ...item, status: nextStatus.toLowerCase() } : item))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus.toLowerCase() } : null));
      }
    }
  };

  // ── 2. Save Staff Internal Notes ──
  const handleSaveInternalNotes = async () => {
    if (!selectedOrder) return;
    setNotesSaving(true);
    await updateOrderInternalNotes(selectedOrder.id, internalNotesInput);

    setOrders((prev) =>
      prev.map((item) =>
        item.id === selectedOrder.id ? { ...item, internal_notes: internalNotesInput } : item
      )
    );
    setSelectedOrder((prev) => (prev ? { ...prev, internal_notes: internalNotesInput } : null));

    setNotesSaving(false);
    setNotesSavedSuccess(true);
    setTimeout(() => setNotesSavedSuccess(false), 2000);
  };

  // ── 3. Issue Refund ──
  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setRefundProcessing(true);
    const { error, refund } = await issueOrderRefund(
      selectedOrder.id,
      refundAmount,
      refundReason,
      refundNotes
    );

    if (!error && refund) {
      const updatedOrder: AdminOrder = {
        ...selectedOrder,
        payment_status: 'refunded',
        status: 'refunded',
        refunds: [...selectedOrder.refunds, refund]
      };

      setOrders((prev) =>
        prev.map((item) => (item.id === selectedOrder.id ? updatedOrder : item))
      );
      setSelectedOrder(updatedOrder);
      setShowRefundModal(false);
      setRefundNotes('');
    } else {
      alert(`Refund failed: ${error}`);
    }
    setRefundProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Delivered
        </span>
      );
    }
    if (['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-sky-950/40 text-sky-300 border border-sky-500/30">
          <Truck className="w-2.5 h-2.5" />
          {s.replace(/_/g, ' ')}
        </span>
      );
    }
    if (['packed', 'confirmed'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-amber-950/40 text-amber-300 border border-amber-500/30">
          <Package className="w-2.5 h-2.5" />
          {s}
        </span>
      );
    }
    if (s === 'placed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-white/10 text-white/80 border border-white/20">
          <Clock className="w-2.5 h-2.5" />
          Placed
        </span>
      );
    }
    if (['refunded', 'cancelled'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-red-950/40 text-red-300 border border-red-500/30">
          <RotateCcw className="w-2.5 h-2.5" />
          {s}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[9px] uppercase font-mono bg-white/5 text-white/60 border border-white/10">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HEADER & METRIC SUMMARY                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Client Orders & Fulfilment
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Track order pipelines live, manage refunds, write atelier notes, and print packing slips.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-2 bg-[#18181D] hover:bg-white/10 text-white px-3.5 py-2 text-xs uppercase font-mono tracking-wider border border-white/15 transition-colors"
        >
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">Total Orders</span>
          <span className="text-2xl font-light font-mono text-white mt-1 block">{stats.totalCount}</span>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">${stats.grossVolume.toFixed(2)} Vol</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'unfulfilled' ? 'all' : 'unfulfilled')}
          className={`p-4 border transition-all cursor-pointer ${
            stats.unfulfilledCount > 0 ? 'bg-amber-950/20 border-amber-500/30' : 'bg-[#121215] border-white/10'
          }`}
        >
          <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400 block">Awaiting Packing</span>
          <span className="text-2xl font-light font-mono text-amber-300 mt-1 block">{stats.unfulfilledCount}</span>
          <span className="text-[10px] font-mono text-amber-300/70 mt-1 block">Needs dispatch</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')}
          className="p-4 bg-[#121215] border border-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <span className="text-[9px] font-mono uppercase tracking-widest text-sky-400 block">In Transit</span>
          <span className="text-2xl font-light font-mono text-sky-300 mt-1 block">{stats.inTransitCount}</span>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">With couriers</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          className="p-4 bg-[#121215] border border-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 block">Delivered</span>
          <span className="text-2xl font-light font-mono text-emerald-300 mt-1 block">{stats.deliveredCount}</span>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Completed</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'refunded' ? 'all' : 'refunded')}
          className={`p-4 border transition-all cursor-pointer ${
            stats.refundedCount > 0 ? 'bg-red-950/20 border-red-500/30' : 'bg-[#121215] border-white/10'
          }`}
        >
          <span className="text-[9px] font-mono uppercase tracking-widest text-red-400 block">Refunds / Cancelled</span>
          <span className="text-2xl font-light font-mono text-red-300 mt-1 block">{stats.refundedCount}</span>
          <span className="text-[10px] font-mono text-red-300/70 mt-1 block">Claims logged</span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. FILTER & SEARCH CONTROLS                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121215] border border-white/10 p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { label: 'All Orders', value: 'all', count: stats.totalCount },
              { label: 'Unfulfilled', value: 'unfulfilled', count: stats.unfulfilledCount },
              { label: 'In Transit', value: 'shipped', count: stats.inTransitCount },
              { label: 'Delivered', value: 'delivered', count: stats.deliveredCount },
              { label: 'Refunded', value: 'refunded', count: stats.refundedCount }
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#18181D] border border-white/10 px-3 py-1.5 w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref, client name, phone, city..."
            className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="text-white/40 hover:text-white text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ORDERS TABLE                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[9px]">
              <th className="py-3 px-4">Order Ref & Date</th>
              <th className="py-3 px-4">Client Recipient</th>
              <th className="py-3 px-4">Garments</th>
              <th className="py-3 px-4">Payment Status</th>
              <th className="py-3 px-4">Total Amount</th>
              <th className="py-3 px-4">Pipeline Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-white/40">
                  Retrieving orders register...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-white/40 font-sans">
                  No orders match the selected filter or query.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isCOD = order.payment_method === 'cash_on_delivery';

                return (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsDetailOpen(true);
                    }}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    {/* Ref & Date */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white text-sm tracking-wide">{order.order_number}</p>
                      <span className="text-[10px] text-white/40 block mt-0.5">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="py-3.5 px-4 font-sans">
                      <p className="font-medium text-white">{order.customer_name}</p>
                      <p className="text-[10px] text-white/50 font-mono">
                        {order.shipping_address?.city}, {order.shipping_address?.country}
                      </p>
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                          {order.items.slice(0, 3).map((it, i) => (
                            <img
                              key={i}
                              src={it.image_url}
                              alt={it.product_name}
                              className="w-7 h-8 object-contain bg-[#FAFAFA] border border-white/20 p-0.5 rounded-none"
                            />
                          ))}
                        </div>
                        <span className="text-white/70 text-[11px]">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </td>

                    {/* Payment */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {isCOD ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                            <Banknote className="w-3 h-3" />
                            <span>COD ({order.payment_status})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                            <CreditCard className="w-3 h-3" />
                            <span>Card ({order.payment_status})</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-white font-bold text-sm">
                      {order.total.toFixed(2)} {order.currency || 'EGP'}
                    </td>

                    {/* Pipeline Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPackingSlipOrder(order)}
                          title="Print Packing Slip & Shipping Label"
                          className="p-1.5 bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white text-black hover:bg-white/90 text-[10px] uppercase font-bold tracking-wider transition-colors"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. ORDER DETAIL SLIDE-OVER DRAWER                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={() => setIsDetailOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-[#121215] border-l border-white/10 flex flex-col shadow-2xl">
              {/* Header */}
              <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#151519]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDetailOpen(false)}
                    className="text-white/60 hover:text-white p-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      Order #{selectedOrder.order_number}
                    </h2>
                    <span className="text-[10px] font-mono text-white/40">
                      Placed: {new Date(selectedOrder.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPackingSlipOrder(selectedOrder)}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-white/15"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Packing Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDetailOpen(false)}
                    className="text-white/40 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. LIVE STATUS PIPELINE STEPPER */}
                <div className="bg-[#151519] border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                      ● Live Customer Tracking Pipeline (P2.6)
                    </span>
                    <a
                      href={`/orders/${selectedOrder.id}/track`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono uppercase text-white/50 hover:text-white flex items-center gap-1 underline"
                    >
                      <span>View Live Customer Tracking</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <p className="text-xs text-white/60">
                    Advancing status immediately reflects live on the customer's visual tracking timeline:
                  </p>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-2">
                    {PIPELINE_STAGES.map((st) => {
                      const isActive = selectedOrder.status === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleStatusChange(selectedOrder.id, st.key)}
                          className={`py-2 px-1 text-[10px] font-mono uppercase tracking-wider text-center border transition-all ${
                            isActive
                              ? 'bg-white text-black font-bold border-white ring-2 ring-white/30'
                              : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOrder.status === 'delivered' && selectedOrder.delivered_at && (
                    <p className="text-[10px] font-mono text-emerald-400 pt-1">
                      ✓ Package verified delivered on {new Date(selectedOrder.delivered_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* 2. CUSTOMER & SHIPPING ADDRESS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#151519] border border-white/10 space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                      Client Contact
                    </span>
                    <p className="font-medium text-white text-sm">{selectedOrder.customer_name}</p>
                    <div className="space-y-1 text-xs text-white/70 font-mono">
                      <p className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-white/40" />
                        <span>{selectedOrder.customer_email}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-white/40" />
                        <span>{selectedOrder.customer_phone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#151519] border border-white/10 space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                      Delivery Destination
                    </span>
                    <div className="text-xs text-white/80 font-mono space-y-0.5">
                      <p className="font-medium text-white">{selectedOrder.shipping_address?.street_line1}</p>
                      {selectedOrder.shipping_address?.street_line2 && (
                        <p>{selectedOrder.shipping_address.street_line2}</p>
                      )}
                      <p>
                        {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state}
                      </p>
                      <p className="text-white/50">{selectedOrder.shipping_address?.country}</p>
                    </div>
                  </div>
                </div>

                {/* 3. ORDERED GARMENTS LIST */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 block">
                    Garments In Order ({selectedOrder.items.length})
                  </span>
                  <div className="border border-white/10 bg-[#151519] divide-y divide-white/5">
                    {selectedOrder.items.map((it) => (
                      <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={it.image_url}
                            alt={it.product_name}
                            className="w-10 h-12 object-contain bg-white p-0.5 flex-shrink-0"
                          />
                          <div>
                            <p className="text-xs font-medium text-white">{it.product_name}</p>
                            <p className="text-[10px] font-mono text-white/40">
                              Size: {it.size} · {it.color} · SKU: {it.sku}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs">
                          <span className="text-white font-medium">{it.total_price.toFixed(2)} {selectedOrder.currency || 'EGP'}</span>
                          <span className="text-[10px] text-white/40 block">Qty: {it.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Summary */}
                  <div className="p-3 bg-[#18181D] border border-white/10 text-xs font-mono space-y-1">
                    <div className="flex justify-between text-white/60">
                      <span>Subtotal:</span>
                      <span>{selectedOrder.subtotal.toFixed(2)} {selectedOrder.currency || 'EGP'}</span>
                    </div>
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount:</span>
                        <span>-{selectedOrder.discount_amount.toFixed(2)} {selectedOrder.currency || 'EGP'}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white/60">
                      <span>Delivery:</span>
                      <span>{selectedOrder.shipping_amount === 0 ? 'Complimentary' : `${selectedOrder.shipping_amount.toFixed(2)} ${selectedOrder.currency || 'EGP'}`}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-white/10">
                      <span>Total Amount:</span>
                      <span>{selectedOrder.total.toFixed(2)} {selectedOrder.currency || 'EGP'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. STAFF INTERNAL NOTES */}
                <div className="p-4 bg-[#151519] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/60 font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-white/40" />
                      <span>Atelier Staff Internal Notes</span>
                    </span>
                    {notesSavedSuccess && (
                      <span className="text-emerald-400 text-xs font-mono flex items-center gap-1 animate-fade-in">
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={internalNotesInput}
                    onChange={(e) => setInternalNotesInput(e.target.value)}
                    placeholder="Private staff notes (e.g. VIP client preferences, dispatch nuances, courier tracking ref)..."
                    className="w-full bg-[#18181D] border border-white/15 p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white font-mono"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveInternalNotes}
                      disabled={notesSaving}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider border border-white/15 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{notesSaving ? 'Saving...' : 'Save Internal Note'}</span>
                    </button>
                  </div>
                </div>

                {/* 5. REFUND ENGINE */}
                <div className="p-4 bg-[#151519] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-semibold block">
                        Refunds & Return Claims
                      </span>
                      <span className="text-xs text-white/50">
                        {selectedOrder.refunds.length} refund record(s) on file
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRefundModal(true)}
                      className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Issue Refund</span>
                    </button>
                  </div>

                  {/* Past refunds list */}
                  {selectedOrder.refunds.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {selectedOrder.refunds.map((ref) => (
                        <div key={ref.id} className="p-2.5 bg-[#101014] border border-red-500/20 text-xs font-mono">
                          <div className="flex justify-between font-bold text-red-300">
                            <span>Refunded ${ref.amount.toFixed(2)}</span>
                            <span>{new Date(ref.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-white/60 text-[11px] mt-1">Reason: {ref.reason}</p>
                          {ref.notes && <p className="text-white/40 text-[10px] italic">{ref.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. REFUND ISSUANCE MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#151519] border border-red-500/30 max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRefundModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-5">
              <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-red-400 block font-bold">
                  Financial Settlement
                </span>
                <h3 className="text-base font-light uppercase tracking-wider text-white">
                  Issue Order Refund
                </h3>
              </div>
            </div>

            <form onSubmit={handleConfirmRefund} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Refund Amount (Max: {selectedOrder.total.toFixed(2)} {selectedOrder.currency || 'EGP'}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedOrder.total}
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Reason for Refund *
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-red-400"
                >
                  <option value="Customer Return & Restock">Customer Return & Restock</option>
                  <option value="Damaged / Defective Garment">Damaged / Defective Garment</option>
                  <option value="Incorrect Silhouette Shipped">Incorrect Silhouette Shipped</option>
                  <option value="Order Cancelled Before Dispatch">Order Cancelled Before Dispatch</option>
                  <option value="Goodwill Atelier Adjustment">Goodwill Atelier Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-white/60 mb-1">
                  Atelier Notes / Claim Reference
                </label>
                <textarea
                  rows={2}
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="e.g. Returned via courier package tracking #..."
                  className="w-full bg-[#18181D] border border-white/15 p-2.5 text-white placeholder-white/30 focus:outline-none focus:border-red-400 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 text-xs uppercase text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundProcessing}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {refundProcessing ? 'Processing...' : 'Confirm & Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. PRINTABLE PACKING SLIP & SHIPPING LABEL MODAL              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {packingSlipOrder && (
        <PackingSlipModal
          order={packingSlipOrder}
          onClose={() => setPackingSlipOrder(null)}
        />
      )}
    </div>
  );
};
