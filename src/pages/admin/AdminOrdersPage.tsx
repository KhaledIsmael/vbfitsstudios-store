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
import { exportOrdersToExcel, printOrderInvoice } from '../../lib/adminExport';
import { generateWhatsAppOrderLink } from '../../lib/adminIntegrations';
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
  AlertCircle,
  Download,
  Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

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
    try {
      const data = await fetchAdminOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load admin orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Update notes input whenever a new order is selected
  useEffect(() => {
    if (selectedOrder) {
      setInternalNotesInput(selectedOrder.internal_notes || '');
      setNotesSavedSuccess(false);
    }
  }, [selectedOrder]);

  // Handle changing status
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const res = await updateOrderStatus(orderId, newStatus);
    if (!res.error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } else {
      alert(`عذراً، لم نتمكن من تحديث الحالة: ${res.error || 'خطأ غير معروف'}`);
    }
  };

  // Handle saving internal notes
  const handleSaveInternalNotes = async () => {
    if (!selectedOrder) return;
    setNotesSaving(true);
    setNotesSavedSuccess(false);
    try {
      const res = await updateOrderInternalNotes(selectedOrder.id, internalNotesInput);
      if (!res.error) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === selectedOrder.id ? { ...o, internal_notes: internalNotesInput } : o
          )
        );
        setSelectedOrder((prev) =>
          prev ? { ...prev, internal_notes: internalNotesInput } : null
        );
        setNotesSavedSuccess(true);
        setTimeout(() => setNotesSavedSuccess(false), 3000);
      } else {
        alert(`تعذر حفظ الملاحظة: ${res.error || 'خطأ'}`);
      }
    } finally {
      setNotesSaving(false);
    }
  };

  const handlePurgeTestData = async () => {
    const confirmed = window.confirm(
      'تنبيه هام: هل تريد تصفير وحذف جميع الطلبات التجريبية والبيانات الوهمية لتجهيز المتجر للإنتاج الفعلي النظيف؟'
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('purge_all_test_data');
      if (error) {
        alert(
          'تنبيه: لتنفيذ التصفير الكامل، يرجى تشغيل سكربت purge_all_test_data.sql المحدث في محرر SQL في Supabase.'
        );
      } else {
        alert('تم تصفير جميع الطلبات التجريبية بنجاح! المتجر الآن جاهز للإنتاج ببيانات نظيفة 100%.');
      }
      await loadOrders();
    } catch (e: any) {
      alert('حدث خطأ أثناء التصفير: ' + (e?.message || 'خطأ غير متوقع'));
    } finally {
      setLoading(false);
    }
  };

  // Filtered orders based on search and tab filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Filter by Status Tab
      const s = (o.status || '').toLowerCase();
      if (statusFilter === 'unfulfilled') {
        if (!['placed', 'pending', 'confirmed', 'packed', 'processing'].includes(s)) {
          return false;
        }
      } else if (statusFilter === 'shipped') {
        if (!['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
          return false;
        }
      } else if (statusFilter === 'delivered') {
        if (s !== 'delivered') {
          return false;
        }
      } else if (statusFilter === 'cancelled') {
        if (!['cancelled', 'refunded'].includes(s)) {
          return false;
        }
      }

      // 2. Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = (o.order_number || '').toLowerCase().includes(q);
        const matchesName = (o.customer_name || '').toLowerCase().includes(q);
        const matchesPhone = (o.customer_phone || '').toLowerCase().includes(q);
        const matchesEmail = (o.customer_email || '').toLowerCase().includes(q);
        const matchesCity = (o.shipping_address?.city || '').toLowerCase().includes(q);
        const matchesGov = ((o.shipping_address as any)?.governorate || '').toLowerCase().includes(q);

        if (!matchesNum && !matchesName && !matchesPhone && !matchesEmail && !matchesCity && !matchesGov) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Counts for top quick filter tabs
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const unfulfilledCount = orders.filter((o) =>
      ['placed', 'pending', 'confirmed', 'packed', 'processing'].includes((o.status || '').toLowerCase())
    ).length;
    const inTransitCount = orders.filter((o) =>
      ['shipped', 'in_transit', 'out_for_delivery'].includes((o.status || '').toLowerCase())
    ).length;
    const deliveredCount = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered').length;
    const grossVolume = orders
      .filter((o) => !['cancelled', 'refunded'].includes((o.status || '').toLowerCase()))
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return { totalCount, unfulfilledCount, inTransitCount, deliveredCount, grossVolume };
  }, [orders]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          تم التوصيل بنجاح
        </span>
      );
    }
    if (['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <Truck className="w-3 h-3 text-blue-600" />
          مع شركة الشحن
        </span>
      );
    }
    if (['confirmed', 'packed', 'processing'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <Package className="w-3 h-3 text-purple-600" />
          تم التجهيز والتغليف
        </span>
      );
    }
    if (s === 'placed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          طلب جديد (قيد المراجعة)
        </span>
      );
    }
    if (['cancelled', 'refunded'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          ملغي / مسترجع
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-bold">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-slate-800">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص السريع                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              إدارة الطلبات وشحنات الزبائن
            </h1>
            <AdminInfoTooltip
              title="صفحة إدارة الطلبات"
              description="هنا تجد جميع الأوردرات التي تمت على الموقع. يمكنك متابعة حالة كل طلب، تأكيد العنوان مع العميل عبر الواتساب، وتحديث حالة الشحن ليتابعها العميل مباشرة في حسابه."
              impact="أي تغيير في حالة الطلب يظهر فوراً للعميل في صفحة تتبع الأوردر."
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            تابع دورة الشحن، تواصل مع العملاء في مصر، اطبع بوالص الشحن والفواتير، وسجل ملاحظات التوصيل.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold border border-slate-200 transition-colors rounded-lg shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : 'text-slate-400'}`} />
            <span>تحديث الطلبات</span>
          </button>

          <button
            type="button"
            onClick={() => exportOrdersToExcel(filteredOrders)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold transition-all rounded-lg shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePurgeTestData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-xs font-bold border border-red-200 transition-colors rounded-lg shadow-2xs cursor-pointer"
            title="حذف الأوردرات التجريبية وتجهيز المتجر للإنتاج"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>تصفير الداتا التجريبية</span>
          </button>
        </div>
      </div>

      {/* كروت الإحصائيات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              إجمالي الطلبات
            </span>
            <ShoppingBag className={`w-4 h-4 ${statusFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <span className="text-2xl font-extrabold font-mono mt-1 block">{stats.totalCount}</span>
          <span className={`text-[11px] font-mono mt-1 block font-bold ${statusFilter === 'all' ? 'text-amber-400' : 'text-slate-500'}`}>
            {stats.grossVolume.toLocaleString()} ج.م مبيعات
          </span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'unfulfilled' ? 'all' : 'unfulfilled')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'unfulfilled'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
              : 'bg-amber-50/70 border-amber-200 hover:border-amber-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${statusFilter === 'unfulfilled' ? 'text-slate-950' : 'text-amber-800'}`}>
              تحتاج تجهيز وتغليف
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'unfulfilled' ? 'text-slate-950' : 'text-amber-600'}`} />
          </div>
          <span className={`text-2xl font-extrabold font-mono mt-1 block ${statusFilter === 'unfulfilled' ? 'text-slate-950' : 'text-amber-900'}`}>
            {stats.unfulfilledCount}
          </span>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'unfulfilled' ? 'text-slate-900' : 'text-amber-700'}`}>
            جاهزة للتجهيز والشحن
          </span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'shipped'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-blue-50/70 border-blue-200 hover:border-blue-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${statusFilter === 'shipped' ? 'text-white' : 'text-blue-800'}`}>
              مع شركة الشحن
            </span>
            <Truck className={`w-4 h-4 ${statusFilter === 'shipped' ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <span className={`text-2xl font-extrabold font-mono mt-1 block ${statusFilter === 'shipped' ? 'text-white' : 'text-blue-900'}`}>
            {stats.inTransitCount}
          </span>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'shipped' ? 'text-blue-100' : 'text-blue-700'}`}>
            في طريقها للزبون
          </span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'delivered'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${statusFilter === 'delivered' ? 'text-white' : 'text-emerald-800'}`}>
              تم التوصيل بنجاح
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'delivered' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <span className={`text-2xl font-extrabold font-mono mt-1 block ${statusFilter === 'delivered' ? 'text-white' : 'text-emerald-900'}`}>
            {stats.deliveredCount}
          </span>
          <span className={`text-[11px] mt-1 block font-medium ${statusFilter === 'delivered' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            أوردرات مكتملة
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. شريط البحث والتصفية                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 sm:p-4 border border-slate-200 rounded-xl shadow-2xs">
        {/* حقل البحث */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الأوردر، اسم العميل، رقم الهاتف، أو المحافظة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              className={`px-3 py-2 rounded-lg whitespace-nowrap text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">لم يتم العثور على طلبات مطابقة للبحث</p>
            <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم أو رقم التليفون بشكل صحيح أو غيّر الفلتر.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">رقم الأوردر</th>
                  <th className="py-3.5 px-4 font-bold">العميل والتواصل</th>
                  <th className="py-3.5 px-4 font-bold">المحافظة / العنوان</th>
                  <th className="py-3.5 px-4 font-bold">القطع</th>
                  <th className="py-3.5 px-4 font-bold">طريقة الدفع</th>
                  <th className="py-3.5 px-4 font-bold">الإجمالي</th>
                  <th className="py-3.5 px-4 font-bold">حالة الطلب</th>
                  <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const waLink = generateWhatsAppOrderLink(order);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors">
                        #{order.order_number || order.id.slice(0, 8)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.customer_name || 'عميل المتجر'}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                            {order.customer_phone || order.customer_email || 'غير مسجل'}
                          </span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="تواصل وتأكيد الأوردر عبر واتساب"
                              className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 font-bold"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>واتساب</span>
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-bold text-slate-800">
                          {(order as any).governorate || (order.shipping_address as any)?.governorate || order.shipping_address?.state || order.shipping_address?.city || 'القاهرة'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {order.shipping_address?.street_line1 || (order.shipping_address as any)?.street_address || (order.shipping_address as any)?.street || '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">
                        {order.items?.length || 1} قطعة
                      </td>

                      <td className="py-3.5 px-4">
                        {order.payment_method === 'COD' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                            كاش عند الاستلام
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            بطاقة / إلكتروني
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                        {order.total.toLocaleString()} <span className="text-[10px] font-sans text-amber-600 font-bold">ج.م</span>
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
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-700" />
                          </button>

                          <button
                            type="button"
                            onClick={() => printOrderInvoice(order)}
                            title="طباعة الفاتورة كـ PDF"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-700" />
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          <div
            dir="rtl"
            className="relative w-full max-w-xl bg-white border-r border-slate-200 h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between shadow-2xl z-10 text-slate-800"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-slate-900 font-mono">
                      طلب #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    تاريخ الطلب: {new Date(selectedOrder.created_at).toLocaleString('ar-EG')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* تحديث حالة الطلب السريع */}
              <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">تحديث حالة الشحن:</span>
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
                      className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        selectedOrder.status === st.id
                          ? 'bg-amber-400 text-slate-950 font-extrabold border-amber-400 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* بيانات العميل والتواصل */}
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center justify-between">
                    <span>بيانات العميل والعنوان</span>
                    {generateWhatsAppOrderLink(selectedOrder) && (
                      <a
                        href={generateWhatsAppOrderLink(selectedOrder)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-200 px-2.5 py-1 rounded-md font-bold transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>فتح محادثة واتساب</span>
                      </a>
                    )}
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">اسم العميل</span>
                      <span className="font-bold text-slate-900">{selectedOrder.customer_name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">رقم الهاتف</span>
                      <span className="font-mono font-bold text-slate-900" dir="ltr">
                        {selectedOrder.customer_phone || '-'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block font-bold">البريد الإلكتروني</span>
                      <span className="text-slate-600 font-mono text-[11px]">{selectedOrder.customer_email || 'غير مسجل'}</span>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold">العنوان المصري بالتفصيل</span>
                      <p className="text-slate-900 font-medium mt-0.5">
                        {((selectedOrder.shipping_address as any)?.governorate || selectedOrder.shipping_address?.state || 'المحافظة')}{' '}
                        - {selectedOrder.shipping_address?.city || 'المدينة'}{' '}
                        {selectedOrder.shipping_address?.street_line1 ? `- شارع: ${selectedOrder.shipping_address.street_line1}` : ''}
                        {(selectedOrder.shipping_address as any)?.building ? ` - عمارة: ${(selectedOrder.shipping_address as any).building}` : ''}
                        {(selectedOrder.shipping_address as any)?.apartment ? ` - شقة: ${(selectedOrder.shipping_address as any).apartment}` : ''}
                      </p>
                      {(selectedOrder.shipping_address as any)?.notes && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 p-2 border border-amber-200 rounded mt-1.5 font-medium">
                          علامة مميزة / ملاحظة العميل: {(selectedOrder.shipping_address as any).notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* القطع والمقاسات المطلوبة */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-200 mb-3">
                    محتويات الأوردر ({selectedOrder.items?.length || 0} قطعة)
                  </h4>

                  <div className="space-y-3">
                    {selectedOrder.items?.map((item, idx) => {
                      const itemPrice = item.unit_price || (item as any).price || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 text-xs pb-2 border-b border-slate-200 last:border-0">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                                className="w-12 h-14 object-cover rounded-lg bg-white border border-slate-200 shadow-2xs"
                              />
                            ) : (
                              <div className="w-12 h-14 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900">{item.product_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                  مقاس: {item.size}
                                </span>
                                <span>الكمية: {item.quantity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-left font-mono font-bold text-slate-900">
                            {(itemPrice * item.quantity).toLocaleString()}{' '}
                            <span className="text-[10px] font-sans text-amber-600 font-bold">ج.م</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* الإجمالي */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>المبلغ المطلوب تحصيله:</span>
                    <span className="text-base font-mono text-slate-900 font-extrabold">
                      {selectedOrder.total.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* ملاحظات الإدارة الخاصة */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">ملاحظات داخلية (خاصة بك وفريق العمل)</span>
                    {notesSavedSuccess && (
                      <span className="text-[11px] text-emerald-600 font-bold">تم الحفظ بنجاح!</span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={internalNotesInput}
                    onChange={(e) => setInternalNotesInput(e.target.value)}
                    placeholder="مثال: تم التأكيد تليفونياً، ميعاد التسليم غداً من 2 لـ 6 مساءً..."
                    className="w-full bg-white border border-slate-200 p-2.5 text-xs text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveInternalNotes}
                      disabled={notesSaving}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      {notesSaving ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* أزرار أسفل الدرج */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => printOrderInvoice(selectedOrder)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>طباعة الفاتورة كـ PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal طباعة البوليصة البديل */}
      {packingSlipOrder && (
        <PackingSlipModal
          order={packingSlipOrder}
          onClose={() => setPackingSlipOrder(null)}
        />
      )}
    </div>
  );
};
