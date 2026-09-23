import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminOrders,
  updateOrderStatus,
  updateOrderInternalNotes,
  type AdminOrder,
  type AdminOrderItem
} from '../../lib/adminOrders';
import { PackingSlipModal } from '../../components/admin/PackingSlipModal';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import {
  Search,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  Printer,
  Check,
  X,
  ArrowLeft,
  FileText,
  Save,
  Package,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  MessageCircle,
  Eye,
  AlertCircle
} from 'lucide-react';

type OrderStatusFilter = 'all' | 'unfulfilled' | 'shipped' | 'delivered' | 'cancelled';

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
    }
  }, [selectedOrder]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === 'unfulfilled' && !['placed', 'confirmed', 'packed', 'pending', 'processing'].includes(o.status)) return false;
      if (statusFilter === 'shipped' && !['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)) return false;
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;
      if (statusFilter === 'cancelled' && !['refunded', 'cancelled'].includes(o.status)) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(q)) ||
        (o.shipping_address?.city && o.shipping_address.city.toLowerCase().includes(q)) ||
        (o.shipping_address?.state && o.shipping_address.state.toLowerCase().includes(q)) ||
        ((o.shipping_address as any)?.governorate && (o.shipping_address as any).governorate.toLowerCase().includes(q))
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
    const grossVolume = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return { totalCount, unfulfilledCount, inTransitCount, deliveredCount, grossVolume };
  }, [orders]);

  // 1. Update Order Status (Reflects live on Customer Tracking Timeline)
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

  // 2. Save Staff Internal Notes
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

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          تم التوصيل
        </span>
      );
    }
    if (['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-sky-950/60 text-sky-300 border border-sky-500/30">
          <Truck className="w-3 h-3 text-sky-400" />
          مع المندوب / الشحن
        </span>
      );
    }
    if (['packed', 'confirmed'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
          <Package className="w-3 h-3 text-amber-400" />
          تم تجهيز وتغليف الطلب
        </span>
      );
    }
    if (s === 'placed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3 text-amber-400" />
          طلب جديد (قيد المراجعة)
        </span>
      );
    }
    if (['cancelled', 'refunded'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded bg-red-950/60 text-red-300 border border-red-500/30">
          ملغي / مسترجع
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-[11px] font-mono bg-white/5 text-white/70 border border-white/10 rounded">
        {status}
      </span>
    );
  };

  // Helper to format WhatsApp link for Egyptian phone numbers
  const getWhatsAppLink = (phone?: string) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('01')) {
      clean = '2' + clean;
    } else if (clean.startsWith('1')) {
      clean = '20' + clean;
    }
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-white">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص السريع                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              إدارة الطلبات وشحنات الزبائن
            </h1>
            <AdminInfoTooltip
              title="صفحة إدارة الطلبات"
              description="هنا تجد جميع الأوردرات التي تمت على الموقع. يمكنك متابعة حالة كل طلب، تأكيد العنوان مع العميل عبر الواتساب، وتحديث حالة الشحن ليتابعها العميل مباشرة في حسابه."
              impact="أي تغيير في حالة الطلب يظهر فوراً للعميل في صفحة تتبع الأوردر."
            />
          </div>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            تابع دورة الشحن، تواصل مع العملاء في مصر، اطبع بوالص الشحن والفواتير، وسجل ملاحظات التوصيل.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-2 bg-[#16161B] hover:bg-white/10 text-white px-4 py-2 text-xs font-semibold border border-white/15 transition-colors rounded-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الطلبات لايف</span>
        </button>
      </div>

      {/* كروت الإحصائيات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === 'all' ? 'bg-[#18181E] border-white/30' : 'bg-[#141418] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">إجمالي الطلبات</span>
            <ShoppingBag className="w-4 h-4 text-white/50" />
          </div>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">{stats.totalCount}</span>
          <span className="text-[11px] text-amber-400 font-mono mt-1 block">
            {stats.grossVolume.toLocaleString()} ج.م مبيعات
          </span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'unfulfilled' ? 'all' : 'unfulfilled')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === 'unfulfilled'
              ? 'bg-amber-950/40 border-amber-400'
              : stats.unfulfilledCount > 0
              ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60'
              : 'bg-[#141418] border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">تحتاج تجهيز وتغليف</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-300 mt-1 block">{stats.unfulfilledCount}</span>
          <span className="text-[11px] text-amber-300/80 mt-1 block">جاهزة للتجهيز والشحن</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === 'shipped' ? 'bg-sky-950/40 border-sky-400' : 'bg-[#141418] border-white/10 hover:border-sky-400/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-300">مع شركة الشحن</span>
            <Truck className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-sky-300 mt-1 block">{stats.inTransitCount}</span>
          <span className="text-[11px] text-sky-300/80 mt-1 block">في طريقها للزبون</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === 'delivered' ? 'bg-emerald-950/40 border-emerald-400' : 'bg-[#141418] border-white/10 hover:border-emerald-400/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">تم التوصيل بنجاح</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-300 mt-1 block">{stats.deliveredCount}</span>
          <span className="text-[11px] text-emerald-300/80 mt-1 block">أوردرات مكتملة</span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. شريط البحث والتصفية                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#141418] p-3 sm:p-4 border border-white/10 rounded-sm">
        {/* حقل البحث */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الأوردر، اسم العميل، رقم الهاتف، أو المحافظة..."
            className="w-full bg-[#18181E] border border-white/10 rounded-sm pr-10 pl-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* فلاتر الحالات */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'كل الطلبات' },
            { id: 'unfulfilled', label: 'قيد التجهيز' },
            { id: 'shipped', label: 'مع الشحن' },
            { id: 'delivered', label: 'تم التوصيل' },
            { id: 'cancelled', label: 'ملغي / مرتجع' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as OrderStatusFilter)}
              className={`px-3 py-1.5 rounded-sm whitespace-nowrap text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. جدول الطلبات                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#141418] border border-white/10 rounded-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-white/50">
            <ShoppingBag className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-sm font-semibold text-white/80">لم يتم العثور على طلبات مطابقة للبحث</p>
            <p className="text-xs text-white/40 mt-1">تأكد من كتابة الاسم أو رقم التليفون بشكل صحيح أو غيّر الفلتر.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-white/5 text-white/60 font-mono text-[11px] uppercase border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">رقم الأوردر</th>
                  <th className="py-3.5 px-4 font-semibold">العميل والتواصل</th>
                  <th className="py-3.5 px-4 font-semibold">المحافظة / العنوان</th>
                  <th className="py-3.5 px-4 font-semibold">القطع</th>
                  <th className="py-3.5 px-4 font-semibold">طريقة الدفع</th>
                  <th className="py-3.5 px-4 font-semibold">الإجمالي</th>
                  <th className="py-3.5 px-4 font-semibold">حالة الطلب</th>
                  <th className="py-3.5 px-4 font-semibold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((order) => {
                  const waLink = getWhatsAppLink(order.customer_phone);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-white group-hover:text-amber-400 transition-colors">
                        {order.order_number}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{order.customer_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-white/60 font-mono" dir="ltr">
                            {order.customer_phone || order.customer_email}
                          </span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="تواصل مع العميل عبر واتساب"
                              className="text-emerald-400 hover:text-emerald-300 p-0.5 inline-flex"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white/70">
                        <div>{order.shipping_address?.city || order.shipping_address?.state || (order.shipping_address as any)?.governorate || 'القاهرة'}</div>
                        <div className="text-[10px] text-white/40 truncate max-w-[150px]">
                          {order.shipping_address?.street_line1 || (order.shipping_address as any)?.street || '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-white/70">
                        {order.items?.length || 1} قطعة
                      </td>

                      <td className="py-3.5 px-4">
                        {order.payment_method === 'COD' ? (
                          <span className="text-amber-300 font-medium">كاش عند الاستلام</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">فيزا / إلكتروني</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {order.total.toLocaleString()} <span className="text-[10px] font-sans text-amber-400 font-semibold">ج.م</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(order.status)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailOpen(true);
                            }}
                            title="عرض تفاصيل الطلب"
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setPackingSlipOrder(order)}
                            title="طباعة بوليصة الشحن"
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. درج تفاصيل الطلب (Order Detail Drawer)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            onClick={() => setIsDetailOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          <div
            dir="rtl"
            className="relative w-full max-w-xl bg-[#121216] border-r border-white/10 h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between shadow-2xl z-10"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white font-mono">
                      طلب #{selectedOrder.order_number}
                    </span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">
                    تاريخ الطلب: {new Date(selectedOrder.created_at).toLocaleString('ar-EG')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-white/60 hover:text-white p-1 rounded hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* تحديث حالة الطلب السريع */}
              <div className="my-5 p-4 bg-[#16161C] border border-white/10 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">تحديث حالة الشحن:</span>
                    <AdminInfoTooltip
                      title="تغيير حالة الطلب"
                      description="عند تغيير الحالة، يتحدث مؤشر التتبع للعميل لايف على الموقع ليتابع أين وصل طرده."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { id: 'placed', label: '1. قيد المراجعة' },
                    { id: 'packed', label: '2. تم التجهيز' },
                    { id: 'shipped', label: '3. مع الشحن' },
                    { id: 'delivered', label: '4. تم التوصيل' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder.id, st.id)}
                      className={`p-2 rounded-sm border text-xs font-medium transition-all ${
                        selectedOrder.status === st.id
                          ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-md'
                          : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* بيانات العميل والتواصل */}
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-[#16161C] border border-white/10 rounded-sm space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 pb-2 border-b border-white/10 flex items-center justify-between">
                    <span>بيانات العميل والعنوان</span>
                    {getWhatsAppLink(selectedOrder.customer_phone) && (
                      <a
                        href={getWhatsAppLink(selectedOrder.customer_phone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>فتح محادثة واتساب</span>
                      </a>
                    )}
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-white/50 block">اسم العميل</span>
                      <span className="font-semibold text-white">{selectedOrder.customer_name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-white/50 block">رقم الهاتف</span>
                      <span className="font-mono text-white" dir="ltr">
                        {selectedOrder.customer_phone || '-'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[10px] text-white/50 block">البريد الإلكتروني</span>
                      <span className="text-white/80 font-mono text-[11px]">{selectedOrder.customer_email}</span>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-white/50 block">العنوان المصري بالتفصيل</span>
                      <p className="text-white font-medium mt-0.5">
                        {((selectedOrder.shipping_address as any)?.governorate || selectedOrder.shipping_address?.state || 'المحافظة')}{' '}
                        - {selectedOrder.shipping_address?.city || 'المدينة'}{' '}
                        {selectedOrder.shipping_address?.street_line1 ? `- شارع: ${selectedOrder.shipping_address.street_line1}` : ''}
                        {(selectedOrder.shipping_address as any)?.building ? ` - عمارة: ${(selectedOrder.shipping_address as any).building}` : ''}
                        {(selectedOrder.shipping_address as any)?.apartment ? ` - شقة: ${(selectedOrder.shipping_address as any).apartment}` : ''}
                      </p>
                      {(selectedOrder.shipping_address as any)?.notes && (
                        <p className="text-[11px] text-amber-400 mt-1">
                          علامة مميزة / ملاحظة العميل: {(selectedOrder.shipping_address as any).notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* القطع والمقاسات المطلوبة */}
                <div className="p-4 bg-[#16161C] border border-white/10 rounded-sm">
                  <h4 className="text-xs font-bold text-white pb-2 border-b border-white/10 mb-3">
                    محتويات الأوردر ({selectedOrder.items?.length || 0} قطعة)
                  </h4>

                  <div className="space-y-3">
                    {selectedOrder.items?.map((item, idx) => {
                      const itemPrice = item.unit_price || (item as any).price || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 text-xs pb-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                                className="w-12 h-14 object-cover rounded bg-white/5 border border-white/10"
                              />
                            ) : (
                              <div className="w-12 h-14 bg-white/5 border border-white/10 rounded flex items-center justify-center text-white/30">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white">{item.product_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-white/60 mt-0.5 font-mono">
                                <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[10px]">
                                  مقاس: {item.size}
                                </span>
                                <span>الكمية: {item.quantity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-left font-mono font-bold text-white">
                            {(itemPrice * item.quantity).toLocaleString()}{' '}
                            <span className="text-[10px] font-sans text-amber-400">ج.م</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* الإجمالي */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-white">
                    <span>المبلغ المطلوب تحصيله:</span>
                    <span className="text-base font-mono text-amber-400">
                      {selectedOrder.total.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* ملاحظات الإدارة الخاصة */}
                <div className="p-4 bg-[#16161C] border border-white/10 rounded-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">ملاحظات داخلية (خاصة بك وفريق العمل)</span>
                    {notesSavedSuccess && (
                      <span className="text-[11px] text-emerald-400 font-semibold">تم الحفظ بنجاح!</span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={internalNotesInput}
                    onChange={(e) => setInternalNotesInput(e.target.value)}
                    placeholder="مثال: تم التأكيد تليفونياً، ميعاد التسليم غداً من 2 لـ 6 مساءً..."
                    className="w-full bg-[#121216] border border-white/15 p-2.5 text-xs text-white placeholder-white/30 rounded focus:outline-none focus:border-amber-400"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveInternalNotes}
                      disabled={notesSaving}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded transition-colors"
                    >
                      {notesSaving ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* أزرار أسفل الدرج */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPackingSlipOrder(selectedOrder)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-black font-bold text-xs rounded hover:bg-white/90 transition-all shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة بوليصة الشحن والفاتورة</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded border border-white/10 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal طباعة البوليصة */}
      {packingSlipOrder && (
        <PackingSlipModal
          order={packingSlipOrder}
          onClose={() => setPackingSlipOrder(null)}
        />
      )}
    </div>
  );
};
