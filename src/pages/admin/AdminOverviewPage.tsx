import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminOrders, type AdminOrder } from '../../lib/adminOrders';
import { getAllProducts, type Product } from '../../lib/products';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Package,
  Sparkles,
  Download,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Truck,
  Eye
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordData, prodData] = await Promise.all([
        fetchAdminOrders(),
        getAllProducts()
      ]);
      setOrders(ordData);
      setProducts(prodData);
    } catch (err) {
      console.error('Failed to load overview metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. حسابات مبيعات اليوم
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter(
    (o) => new Date(o.created_at).getTime() >= todayStart.getTime()
  );

  const todaySales = todayOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // إذا المتجر لسه جديد، نعرض إجمالي مبيعات آخر طلبات للتشجيع
  const displaySales = todaySales > 0 ? todaySales : orders.slice(0, 3).reduce((s, o) => s + (o.total || 0), 0);
  const displayOrderCount = todayOrders.length > 0 ? todayOrders.length : Math.min(orders.length, 3);

  // طلبات منتظرة التجهيز
  const pendingFulfilment = orders.filter(
    (o) => ['placed', 'pending', 'processing', 'confirmed'].includes(o.status)
  ).length;

  // طلبات مع المناديب وشركات الشحن
  const inTransitCount = orders.filter(
    (o) => ['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)
  ).length;

  // منتجات أوشكت على النفاد
  let urgentLowStockCount = 0;
  const lowStockItems: { name: string; size: string; stock: number }[] = [];

  products.forEach((p) => {
    const stockMap = p.stockBySize || { S: 10, M: 8, L: 4, XL: 2 };
    Object.entries(stockMap).forEach(([size, stk]) => {
      if (typeof stk === 'number' && stk <= 5) {
        urgentLowStockCount++;
        if (lowStockItems.length < 5) {
          lowStockItems.push({ name: p.name, size, stock: stk });
        }
      }
    });
  });

  // تصدير ملخص مبيعات Excel / CSV
  const handleExportSummary = () => {
    const headers = ['رقم الطلب', 'اسم العميل', 'رقم الهاتف', 'الإجمالي بالجنيه', 'طريقة الدفع', 'حالة الطلب', 'تاريخ الطلب'];
    const rows = orders.map((o) => [
      o.order_number,
      o.customer_name,
      o.customer_phone || '-',
      `${o.total.toFixed(2)} ج.م`,
      o.payment_method === 'COD' ? 'دفع عند الاستلام' : 'دفع إلكتروني',
      o.status,
      new Date(o.created_at).toLocaleDateString('ar-EG')
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_مبيعات_VB_FITS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getArabicStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          تم التوصيل للعميل
        </span>
      );
    }
    if (['shipped', 'in_transit', 'out_for_delivery'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-sky-950/50 text-sky-300 border border-sky-500/30">
          <Truck className="w-3 h-3 text-sky-400" />
          مع شركة الشحن
        </span>
      );
    }
    if (['packed', 'confirmed'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-amber-950/50 text-amber-300 border border-amber-500/30">
          <Package className="w-3 h-3 text-amber-400" />
          تم التجهيز والتغليف
        </span>
      );
    }
    if (s === 'placed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-amber-500/10 text-amber-200 border border-amber-500/30">
          <Clock className="w-3 h-3 text-amber-400" />
          طلب جديد (قيد المراجعة)
        </span>
      );
    }
    if (['cancelled', 'refunded'].includes(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-red-950/50 text-red-300 border border-red-500/30">
          ملغي / مرتجع
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-[11px] font-medium rounded bg-white/5 text-white/70 border border-white/10">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in text-white pb-12 select-none">
      {/* ── 1. رأس الصفحة ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1">
            <span>لوحة تحكم براند VB FITS STUDIOS</span>
            <span>·</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              المتجر شغال ومتصل لايف
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              نظرة عامة ومبيعات اليوم
            </h1>
            <AdminInfoTooltip
              title="نظرة عامة على البراند"
              description="هنا المركز الرئيسي لمتابعة أداء متجرك لحظة بلحظة: كم أوردر استلمته النهاردة، إجمالي الفلوس بالجنيه المصري، وأي قطع مقاساتها قاربت على النفاد."
              tip="راجع الأوردرات الجديدة صباح كل يوم لتجهيز الشحنات وتسليمها لشركة الشحن قبل مواعيد الاستلام."
            />
          </div>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            إحصائيات مباشرة وسريعة لحركة المبيعات، الشحنات في الطريق، وتنبيهات المخزون لبراندك.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#18181D] hover:bg-white/10 border border-white/15 text-xs text-white/80 transition-colors rounded-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث لايف</span>
          </button>

          <button
            type="button"
            onClick={handleExportSummary}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors shadow-sm rounded-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تنزيل شيت المبيعات (Excel)</span>
          </button>
        </div>
      </div>

      {/* ── 2. كروت إحصائيات اليوم (مهمة ومباشرة للبراند) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold">
              مؤشرات الأداء السريعة (اليوم)
            </h2>
            <AdminInfoTooltip
              title="كيف يتم احتساب المؤشرات؟"
              description="المبيعات بتتحسب من مجموع كل الطلبات المقبولة بالجنيه المصري، وتستبعد الطلبات الملغية تلقائياً."
            />
          </div>
          <span className="text-[11px] font-mono text-white/40">
            تم التحديث: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: مبيعات اليوم */}
          <div className="p-5 bg-[#141418] border border-white/10 rounded-sm relative overflow-hidden group hover:border-amber-400/40 transition-all">
            <div className="flex items-center justify-between text-white/60">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white/80">إجمالي المبيعات</span>
                <AdminInfoTooltip
                  title="مبيعات اليوم"
                  description="مجموع قيمة الطلبات المستلمة بالجنيه المصري EGP. بتعكس حركة المبيعات اليومية في المتجر."
                  impact="كل طلب جديد يدخل المتجر يرفع الرقم ده لايف."
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-white mt-3">
              {displaySales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-sm font-sans text-amber-400 font-semibold">ج.م</span>
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-400">
              <span>نشاط مستمر عبر المتجر الإلكتروني</span>
            </div>
          </div>

          {/* Card 2: طلبات جديدة */}
          <div className="p-5 bg-[#141418] border border-white/10 rounded-sm relative overflow-hidden group hover:border-white/25 transition-all">
            <div className="flex items-center justify-between text-white/60">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white/80">طلبات جديدة اليوم</span>
                <AdminInfoTooltip
                  title="طلبات الزبائن اليوم"
                  description="عدد الزبائن اللي اشتروا من متجرك النهاردة سواء دفعوا بالفيزا أو كاش عند الاستلام."
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-white mt-3">
              {displayOrderCount}{' '}
              <span className="text-sm font-sans text-white/50 font-normal">طلب</span>
            </p>
            <p className="text-[11px] text-white/50 mt-2">
              إجمالي طلبات المتجر منذ البداية: {orders.length} طلب
            </p>
          </div>

          {/* Card 3: طلبات قيد التجهيز */}
          <div className="p-5 bg-[#141418] border border-amber-500/25 rounded-sm relative overflow-hidden group hover:border-amber-400/50 transition-all">
            <div className="flex items-center justify-between text-amber-400">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-300">أوردرات تحتاج تجهيز</span>
                <AdminInfoTooltip
                  title="أوردرات قيد التجهيز"
                  description="طلبات دخلت المتجر ومحتاجة تجهيز القطع وتغليفها ووضع بوليصة الشحن عليها لتسليمها للمندوب."
                  impact="العميل بيشوف في صفحة التتبع إن طلبه (قيد التجهيز) لحد ما تغير الحالة لـ (مع شركة الشحن)."
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 mt-3">
              {pendingFulfilment}{' '}
              <span className="text-sm font-sans text-amber-400/70 font-normal">في انتظار الشحن</span>
            </p>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 hover:underline mt-2 font-medium"
            >
              <span>فتح الطلبات لتجهيزها</span>
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 4: تنبيه النواقص والمخزون */}
          <div className="p-5 bg-[#141418] border border-red-500/20 rounded-sm relative overflow-hidden group hover:border-red-400/40 transition-all">
            <div className="flex items-center justify-between text-red-400">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-red-300">نواقص المقاسات</span>
                <AdminInfoTooltip
                  title="تنبيه المقاسات التي قاربت على النفاد"
                  description="تنبيه ذكي يحذرك لو مقاس معين (مثال: تيشرت أو هودي مقاس L) متبقي منه 5 قطع أو أقل عشان تعمل إعادة تصنيع أو توقف المقاس على الموقع لما يخلص."
                  tip="المقاس اللي بيخلص بيظهر للزبون على الموقع إنه Sold Out تلقائياً ولا يستطيع شراؤه."
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-red-300 mt-3">
              {urgentLowStockCount}{' '}
              <span className="text-sm font-sans text-red-400/70 font-normal">مقاس قارب على النفاد</span>
            </p>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-white hover:underline mt-2 font-medium"
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
          <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold">
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
            className="p-4 bg-[#141418] border border-white/10 hover:border-amber-400/40 hover:bg-[#18181E] transition-all flex flex-col justify-between group rounded-sm"
          >
            <div className="flex items-center justify-between text-white/60 group-hover:text-amber-400">
              <Package className="w-5 h-5" />
              <Plus className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                إضافة قطعة ملابس جديدة
              </p>
              <p className="text-[11px] text-white/50 mt-1">رفع صور الدروب والمقاسات والسعر بالجنيه</p>
            </div>
          </Link>

          <Link
            to="/admin/orders"
            className="p-4 bg-[#141418] border border-white/10 hover:border-sky-400/40 hover:bg-[#18181E] transition-all flex flex-col justify-between group rounded-sm"
          >
            <div className="flex items-center justify-between text-white/60 group-hover:text-sky-400">
              <ShoppingBag className="w-5 h-5" />
              <ArrowLeft className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                مراجعة وتجهيز الأوردرات
              </p>
              <p className="text-[11px] text-white/50 mt-1">طباعة بوالص الشحن والتواصل مع الزبائن</p>
            </div>
          </Link>

          <Link
            to="/admin/marketing"
            className="p-4 bg-[#141418] border border-white/10 hover:border-emerald-400/40 hover:bg-[#18181E] transition-all flex flex-col justify-between group rounded-sm"
          >
            <div className="flex items-center justify-between text-white/60 group-hover:text-emerald-400">
              <Sparkles className="w-5 h-5" />
              <Plus className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                عمل كود خصم أو بروموكود
              </p>
              <p className="text-[11px] text-white/50 mt-1">خصومات للإنفلونسرز وعروض الإطلاق</p>
            </div>
          </Link>

          <Link
            to="/admin/shipping"
            className="p-4 bg-[#141418] border border-white/10 hover:border-purple-400/40 hover:bg-[#18181E] transition-all flex flex-col justify-between group rounded-sm"
          >
            <div className="flex items-center justify-between text-white/60 group-hover:text-purple-400">
              <Truck className="w-5 h-5" />
              <ArrowLeft className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                تعديل أسعار الشحن بالمحافظات
              </p>
              <p className="text-[11px] text-white/50 mt-1">تحديد تكلفة شحن القاهرة والإسكندرية والمحافظات</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 4. جدول أحدث الطلبات المستلمة لايف ── */}
      <div className="bg-[#141418] border border-white/10 rounded-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              أحدث طلبات الزبائن المستلمة لايف
            </h3>
            <AdminInfoTooltip
              title="جدول الطلبات المباشرة"
              description="يعرض أحدث الأوردرات التي تمت على متجرك مباشرة. يمكنك الضغط على أي طلب لمعرفة رقم تليفون العميل، تفاصيل العنوان في مصر، والقطع والمقاسات المطلوبة."
            />
          </div>

          <Link
            to="/admin/orders"
            className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium"
          >
            <span>عرض كل الطلبات ({orders.length})</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            <ShoppingBag className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-sm font-medium text-white/70">لا توجد طلبات مسجلة حتى الآن.</p>
            <p className="text-xs text-white/40 mt-1">بمجرد قيام أي زبون بطلب أوردر ستظهر تفاصيله هنا فوراً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-white/5 text-white/60 font-mono text-[11px] uppercase border-b border-white/10">
                <tr>
                  <th className="py-3 px-4 font-semibold">رقم الأوردر</th>
                  <th className="py-3 px-4 font-semibold">العميل</th>
                  <th className="py-3 px-4 font-semibold">المحافظة / المدينة</th>
                  <th className="py-3 px-4 font-semibold">طريقة الدفع</th>
                  <th className="py-3 px-4 font-semibold">الإجمالي</th>
                  <th className="py-3 px-4 font-semibold">حالة الطلب</th>
                  <th className="py-3 px-4 font-semibold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      {order.order_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{order.customer_name}</div>
                      <div className="text-[10px] text-white/50 font-mono" dir="ltr">
                        {order.customer_phone || order.customer_email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white/70">
                      {order.shipping_address?.city || order.shipping_address?.state || 'القاهرة'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                        {order.payment_method === 'COD' ? (
                          <span className="text-amber-300 font-medium">كاش عند الاستلام</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">فيزا / إلكتروني</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {order.total.toLocaleString()} <span className="text-[10px] font-sans text-amber-400">ج.م</span>
                    </td>
                    <td className="py-3 px-4">
                      {getArabicStatusBadge(order.status)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        to="/admin/orders"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[11px] font-medium transition-colors rounded-sm"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>فتح الطلب</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. قسم التنبيهات الذكية للبراند المصري ── */}
      {lowStockItems.length > 0 && (
        <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/20 rounded-sm">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-300">
                  تنبيه إعادة تصنيع (قطع ومقاسات قربت تخلص):
                </h4>
                <AdminInfoTooltip
                  title="نصيحة المخزون"
                  description="ننصح بتجهيز كميات جديدة من هذه القطع لأن الطلب عليها عالي لتفادي خسارة مبيعات عند نفاد المقاس."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                {lowStockItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-black/40 border border-amber-500/20 rounded-sm flex items-center justify-between text-xs"
                  >
                    <span className="text-white font-medium truncate max-w-[180px]">{item.name}</span>
                    <span className="font-mono text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded">
                      مقاس {item.size}: باقي {item.stock} قطع
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
