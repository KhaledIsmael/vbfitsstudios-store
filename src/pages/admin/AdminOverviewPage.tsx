import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Plus,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  Phone,
  Printer
} from 'lucide-react';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import { fetchAdminOrders, type AdminOrder } from '../../lib/adminOrders';
import { fetchAdminProducts, type AdminProduct } from '../../lib/adminProducts';
import { exportOrdersToExcel, printOrderInvoice } from '../../lib/adminExport';

export const AdminOverviewPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminProducts()
      ]);
      setOrders(o);
      setProducts(p);
    } catch (err) {
      console.error('Error loading dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Today's total sales in EGP (orders not cancelled/refunded)
  const displaySales = useMemo(() => {
    return orders
      .filter((o) => !['cancelled', 'refunded'].includes((o.status || '').toLowerCase()))
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders]);

  // Order counts
  const newOrdersCount = useMemo(() => {
    return orders.filter((o) => ['placed', 'pending'].includes((o.status || '').toLowerCase())).length;
  }, [orders]);

  const readyToShipCount = useMemo(() => {
    return orders.filter((o) =>
      ['confirmed', 'packed', 'processing'].includes((o.status || '').toLowerCase())
    ).length;
  }, [orders]);

  // Low stock variants (stock <= 5)
  const lowStockItems = useMemo(() => {
    const list: Array<{
      productId: string;
      productName: string;
      size: string;
      stock: number;
    }> = [];

    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        if (v.stock !== undefined && v.stock <= 5) {
          list.push({
            productId: p.id,
            productName: p.name,
            size: v.size,
            stock: v.stock
          });
        }
      });
    });

    return list;
  }, [products]);

  const urgentLowStockCount = lowStockItems.length;

  const handleExportSummary = () => {
    if (orders.length === 0) {
      alert('لا توجد طلبات لتصديرها حالياً.');
      return;
    }
    exportOrdersToExcel(orders);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (['delivered'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          تم التوصيل بنجاح
        </span>
      );
    }
    if (['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <Truck className="w-3 h-3 text-blue-600" />
          مع المندوب للشحن
        </span>
      );
    }
    if (['confirmed', 'packed', 'processing'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <Package className="w-3 h-3 text-purple-600" />
          جاهز للتسليم
        </span>
      );
    }
    if (s === 'placed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
          <Clock className="w-3 h-3 text-zinc-600" />
          طلب جديد (قيد المراجعة)
        </span>
      );
    }
    if (['cancelled', 'refunded'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          ملغي / مرتجع
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 pb-12 select-none">
      {/* ── 1. رأس الصفحة ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1 font-semibold">
            <span>لوحة تحكم براند VB FITS STUDIOS</span>
            <span>·</span>
            <span className="text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              المتجر شغال ومتصل لايف
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              نظرة عامة ومبيعات اليوم
            </h1>
            <AdminInfoTooltip
              title="نظرة عامة على البراند"
              description="هنا المركز الرئيسي لمتابعة أداء متجرك لحظة بلحظة: كم أوردر استلمته النهاردة، إجمالي الفلوس بالجنيه المصري، وأي قطع مقاساتها قاربت على النفاد."
              tip="راجع الأوردرات الجديدة صباح كل يوم لتجهيز الشحنات وتسليمها لشركة الشحن قبل مواعيد الاستلام."
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إحصائيات مباشرة وسريعة لحركة المبيعات، الشحنات في الطريق، وتنبيهات المخزون لبراندك.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-700 transition-colors rounded-lg shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zinc-900' : 'text-zinc-500'}`} />
            <span>تحديث لايف</span>
          </button>

          <button
            type="button"
            onClick={handleExportSummary}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            <span>تنزيل شيت المبيعات (Excel)</span>
          </button>
        </div>
      </div>

      {/* ── 2. كروت إحصائيات اليوم (Bright Modern Stat Cards) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
              مؤشرات الأداء السريعة (اليوم)
            </h2>
            <AdminInfoTooltip
              title="كيف يتم احتساب المؤشرات؟"
              description="المبيعات بتتحسب من مجموع كل الطلبات المقبولة بالجنيه المصري، وتستبعد الطلبات الملغية تلقائياً."
            />
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            تم التحديث: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: مبيعات اليوم */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">إجمالي المبيعات</span>
                <AdminInfoTooltip
                  title="مبيعات اليوم"
                  description="مجموع قيمة الطلبات المستلمة بالجنيه المصري EGP. بتعكس حركة المبيعات اليومية في المتجر."
                  impact="كل طلب جديد يدخل المتجر يرفع الرقم ده لايف."
                />
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 mt-3">
              {displaySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-sm font-sans text-zinc-500 font-bold">ج.م</span>
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-600 font-medium">
              <span>نشاط مستمر عبر المتجر الإلكتروني</span>
            </div>
          </div>

          {/* Card 2: طلبات جديدة */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">طلبات جديدة مطلوبة</span>
                <AdminInfoTooltip
                  title="الطلبات الجديدة"
                  description="طلبات زبائن استلمها متجرك وتحتاج فتحها والتأكد من تفاصيل العنوان ورقم التليفون ثم تجهيزها."
                  tip="اضغط على زر فتح الطلبات لتغير حالتها إلى (تم التجهيز) وتطبع بوليصة الشحن."
                />
              </div>
              <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center border border-zinc-200 shadow-2xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 mt-3">
              {newOrdersCount}{' '}
              <span className="text-sm font-sans text-slate-400 font-normal">طلب جديد</span>
            </p>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[11px] text-zinc-900 hover:text-black hover:underline mt-2 font-bold"
            >
              <span>فتح الطلبات لمراجعتها</span>
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 3: شحنات جاهزة للتسليم */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">شحنات جاهزة للتسليم</span>
                <AdminInfoTooltip
                  title="الشحنات الجاهزة"
                  description="الأوردرات التي تم تغليفها وبانتظار مندوب شركة الشحن (بوسطة، أوتو، أرامكس أو مندوبك الخاص) لاستلامها وتوصيلها للعميل."
                />
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 mt-3">
              {readyToShipCount}{' '}
              <span className="text-sm font-sans text-slate-400 font-normal">أوردر جاهز</span>
            </p>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 hover:underline mt-2 font-bold"
            >
              <span>فتح الطلبات لتجهيزها</span>
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 4: تنبيه النواقص والمخزون (No overflow clipping!) */}
          <div className="p-5 bg-rose-50/70 border border-rose-200 rounded-xl shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between text-rose-600">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-rose-800">نواقص المقاسات</span>
                <AdminInfoTooltip
                  title="تنبيه المقاسات التي قاربت على النفاد"
                  description="تنبيه ذكي يحذرك لو مقاس معين (مثال: تيشرت أو هودي مقاس L) متبقي منه 5 قطع أو أقل عشان تعمل إعادة تصنيع أو توقف المقاس على الموقع لما يخلص."
                  tip="المقاس اللي بيخلص بيظهر للزبون على الموقع إنه Sold Out تلقائياً ولا يستطيع شراؤه."
                />
              </div>
              <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-2xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-900 mt-3">
              {urgentLowStockCount}{' '}
              <span className="text-sm font-sans text-rose-600 font-normal">مقاس قارب على النفاد</span>
            </p>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:text-rose-900 hover:underline mt-2 font-bold"
            >
              <span>فحص المخزون والكميات</span>
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3. أزرار المهام السريعة (Quick Action Dock) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
            مهام سريعة بنقرة واحدة
          </h2>
          <AdminInfoTooltip
            title="الإجراءات السريعة"
            description="اختصارات لأكثر المهام اليومية اللي بيحتاجها صاحب البراند لإدارة المتجر بسهولة وسرعة."
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/products"
            className="p-4 bg-white border border-slate-200 hover:border-zinc-900 hover:shadow-md transition-all flex flex-col justify-between group rounded-xl"
          >
            <div className="flex items-center justify-between text-slate-400 group-hover:text-zinc-900">
              <Package className="w-5 h-5" />
              <Plus className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-900 group-hover:text-zinc-900 transition-colors">
                إضافة قطعة ملابس جديدة
              </p>
              <p className="text-[11px] text-slate-500 mt-1">رفع صور الدروب والمقاسات والسعر بالجنيه</p>
            </div>
          </Link>

          <Link
            to="/admin/orders"
            className="p-4 bg-white border border-slate-200 hover:border-zinc-900 hover:shadow-md transition-all flex flex-col justify-between group rounded-xl"
          >
            <div className="flex items-center justify-between text-slate-400 group-hover:text-zinc-900">
              <ShoppingBag className="w-5 h-5" />
              <ArrowLeft className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-900 group-hover:text-zinc-900 transition-colors">
                مراجعة وتجهيز الأوردرات
              </p>
              <p className="text-[11px] text-slate-500 mt-1">طباعة بوالص الشحن والتواصل مع الزبائن</p>
            </div>
          </Link>

          <Link
            to="/admin/marketing"
            className="p-4 bg-white border border-slate-200 hover:border-zinc-900 hover:shadow-md transition-all flex flex-col justify-between group rounded-xl"
          >
            <div className="flex items-center justify-between text-slate-400 group-hover:text-zinc-900">
              <Sparkles className="w-5 h-5" />
              <Plus className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-900 group-hover:text-zinc-900 transition-colors">
                عمل كود خصم أو بروموكود
              </p>
              <p className="text-[11px] text-slate-500 mt-1">خصومات للإنفلونسرز وعروض الإطلاق</p>
            </div>
          </Link>

          <Link
            to="/admin/shipping"
            className="p-4 bg-white border border-slate-200 hover:border-zinc-900 hover:shadow-md transition-all flex flex-col justify-between group rounded-xl"
          >
            <div className="flex items-center justify-between text-slate-400 group-hover:text-zinc-900">
              <Truck className="w-5 h-5" />
              <ArrowLeft className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-900 group-hover:text-zinc-900 transition-colors">
                تعديل أسعار الشحن بالمحافظات
              </p>
              <p className="text-[11px] text-slate-500 mt-1">تحديد تكلفة شحن القاهرة والإسكندرية والمحافظات</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 4. جدول أحدث الطلبات المستلمة لايف ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              أحدث طلبات الزبائن المستلمة لايف
            </h3>
            <AdminInfoTooltip
              title="جدول الطلبات المباشرة"
              description="يعرض أحدث الأوردرات التي تمت على متجرك مباشرة. يمكنك الضغط على أي طلب لمعرفة رقم تليفون العميل، تفاصيل العنوان في مصر، والقطع والمقاسات المطلوبة."
            />
          </div>

          <Link
            to="/admin/orders"
            className="text-xs text-zinc-900 hover:text-black hover:underline flex items-center gap-1 font-bold"
          >
            <span>عرض كل الطلبات ({orders.length})</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">لا توجد طلبات مسجلة حتى الآن.</p>
            <p className="text-xs text-slate-400 mt-1">بمجرد قيام أي زبون بطلب أوردر ستظهر تفاصيله هنا فوراً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم الأوردر</th>
                  <th className="py-3 px-4 font-bold">العميل والمحافظة</th>
                  <th className="py-3 px-4 font-bold">القطع المطلوبة</th>
                  <th className="py-3 px-4 font-bold">الإجمالي بالجنيه</th>
                  <th className="py-3 px-4 font-bold">طريقة الدفع</th>
                  <th className="py-3 px-4 font-bold">حالة الطلب</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{o.order_number || o.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{o.customer_name || 'عميل المتجر'}</p>
                      <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span dir="ltr">{o.customer_phone || 'غير مسجل'}</span>
                        <span>{(o as any).governorate || (o.shipping_address as any)?.governorate || o.shipping_address?.state || 'القاهرة'}</span>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 max-w-[240px]">
                      <p className="truncate text-slate-700 font-medium">
                        {(o.items || []).map((i) => `${i.product_name} (${i.size || 'حر'})`).join(', ') || 'منتجات المتجر'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {o.items?.length || 1} قطعة
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {(o.total || 0).toLocaleString()} <span className="text-zinc-500 font-sans text-[11px] font-bold">ج.م</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {((o.payment_method === 'COD' || (o as any).payment_status === 'pending_collection' || (o as any).notes?.toLowerCase().includes('cash on delivery') || (o as any).notes?.toLowerCase().includes('cod'))) ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                          الدفع عند الاستلام (COD)
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          بطاقة / محفظة
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(o.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => printOrderInvoice(o)}
                          title="طباعة بوليصة وفاتورة الشحن كـ PDF"
                          className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <Link
                          to="/admin/orders"
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-all"
                        >
                          تفاصيل
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. تنبيهات المقاسات التي قاربت على النفاد ── */}
      {urgentLowStockCount > 0 && (
        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <h3 className="text-sm font-bold">
                تنبيه إعادة تصنيع (قطع ومقاسات قربت تخلص):
              </h3>
              <AdminInfoTooltip
                title="إعادة التصنيع والمخزون"
                description="ننصح بتجهيز كميات جديدة من هذه القطع لأن الطلب عليها عالي لتفادي خسارة مبيعات عند نفاد المقاس."
              />
            </div>
            <Link
              to="/admin/products"
              className="text-xs text-rose-700 hover:text-rose-900 hover:underline font-bold"
            >
              تعديل الكميات في المخزن
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.slice(0, 6).map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-rose-200 rounded-lg flex items-center justify-between shadow-2xs"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[180px]">
                    {item.productName}
                  </p>
                  <p className="text-[11px] text-rose-700 font-bold mt-0.5">
                    مقاس {item.size}: باقي {item.stock} قطع فقط
                  </p>
                </div>
                <Link
                  to="/admin/products"
                  className="px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                >
                  زيادة المخزون
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
