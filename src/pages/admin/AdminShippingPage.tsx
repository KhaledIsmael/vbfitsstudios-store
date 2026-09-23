import React, { useState, useEffect } from 'react';
import {
  fetchAdminShippingZones,
  updateAdminShippingZone,
  type AdminShippingZone
} from '../../lib/adminShipping';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import {
  Truck,
  Search,
  Check,
  X,
  RefreshCw,
  Clock,
  MapPin,
  ShieldCheck,
  Edit2,
  CheckCircle2,
  Save,
  DollarSign
} from 'lucide-react';

export const AdminShippingPage: React.FC = () => {
  const [zones, setZones] = useState<AdminShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [codFilter, setCodFilter] = useState<'all' | 'cod_enabled' | 'cod_disabled'>('all');

  // Editing modal / drawer
  const [editingZone, setEditingZone] = useState<AdminShippingZone | null>(null);
  const [editRate, setEditRate] = useState(65);
  const [editMinDays, setEditMinDays] = useState(2);
  const [editMaxDays, setEditMaxDays] = useState(4);
  const [editCod, setEditCod] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminShippingZones();
      setZones(data);
    } catch (err) {
      console.error('Failed to load shipping zones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const handleOpenEdit = (zone: AdminShippingZone) => {
    setEditingZone(zone);
    setEditRate(zone.shipping_rate);
    setEditMinDays(zone.min_days);
    setEditMaxDays(zone.max_days);
    setEditCod(zone.cod_available);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;

    setSaving(true);
    const updates: Partial<AdminShippingZone> = {
      shipping_rate: Number(editRate),
      min_days: Number(editMinDays),
      max_days: Number(editMaxDays),
      cod_available: Boolean(editCod)
    };

    const res = await updateAdminShippingZone(editingZone.governorate, updates);
    setSaving(false);

    if (res.success) {
      setZones((prev) =>
        prev.map((z) => (z.governorate === editingZone.governorate ? { ...z, ...updates } : z))
      );
      setEditingZone(null);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    } else {
      alert(`عذراً، تعذر حفظ التعديل: ${res.error}`);
    }
  };

  const handleToggleCod = async (zone: AdminShippingZone) => {
    const newCod = !zone.cod_available;
    const res = await updateAdminShippingZone(zone.governorate, { cod_available: newCod });
    if (res.success) {
      setZones((prev) =>
        prev.map((z) => (z.governorate === zone.governorate ? { ...z, cod_available: newCod } : z))
      );
    }
  };

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    if (codFilter === 'cod_enabled' && !z.cod_available) return false;
    if (codFilter === 'cod_disabled' && z.cod_available) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNameEn = z.governorate.toLowerCase().includes(q);
      const matchNameAr = (z.governorate_ar || '').toLowerCase().includes(q);
      if (!matchNameEn && !matchNameAr) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-slate-800">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              تكاليف ومناطق الشحن (محافظات مصر)
            </h1>
            <AdminInfoTooltip
              title="تكاليف الشحن بالمحافظات"
              description="حدد تكلفة الشحن بالجنيه المصري EGP ومدة التوصيل المتوقعة لكل محافظة. التكلفة تُضاف تلقائياً في صفحة الدفع (Checkout) للزبون عند اختيار محافظته."
              tip="ننصح بتحديد تكلفة موحدة للقاهرة والجيزة (مثال: 50 جنيه) لتشجيع المشترين في العاصمة."
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            تحكم في مصاريف الشحن لكل محافظة في مصر، حدد أيام التوصيل، وشغّل أو عطّل الدفع كاش عند الاستلام.
          </p>
        </div>

        <button
          type="button"
          onClick={loadZones}
          disabled={loading}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold border border-slate-200 transition-colors rounded-lg shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : 'text-slate-400'}`} />
          <span>تحديث الأسعار لايف</span>
        </button>
      </div>

      {/* Success Banner */}
      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold animate-fade-in shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>تم تحديث تكلفة ومدة الشحن بنجاح! سيظهر السعر الجديد فوراً للعملاء.</span>
        </div>
      )}

      {/* كروت الملخص السريع */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-xs font-bold text-slate-500 block">إجمالي المحافظات المغطاة</span>
          <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
            {zones.length} <span className="text-xs font-sans font-normal text-slate-400">محافظة في مصر</span>
          </span>
        </div>

        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-xs font-bold text-emerald-800 block">متاح بها الدفع عند الاستلام (COD)</span>
          <span className="text-2xl font-extrabold font-mono text-emerald-900 mt-1 block">
            {zones.filter((z) => z.cod_available).length} <span className="text-xs font-sans font-normal text-emerald-700">محافظة</span>
          </span>
        </div>

        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl shadow-2xs">
          <span className="text-xs font-bold text-amber-800 block">متوسط سعر الشحن</span>
          <span className="text-2xl font-extrabold font-mono text-amber-900 mt-1 block">
            {Math.round(zones.reduce((acc, z) => acc + (z.shipping_rate || 65), 0) / (zones.length || 1))}{' '}
            <span className="text-xs font-sans font-bold text-amber-700">ج.م للطلب</span>
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. شريط البحث والفلترة                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 sm:p-4 border border-slate-200 rounded-xl shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المحافظة (مثال: القاهرة، الإسكندرية، أسيوط)..."
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'كل المحافظات' },
            { id: 'cod_enabled', label: 'كاش متاح (COD)' },
            { id: 'cod_disabled', label: 'دفع مسبق فقط' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCodFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg whitespace-nowrap text-xs font-bold transition-all cursor-pointer ${
                codFilter === tab.id
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
      {/* 3. جدول مناطق ومحافظات الشحن                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredZones.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">لم يتم العثور على محافظات مطابقة للبحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">المحافظة / الإقليم</th>
                  <th className="py-3.5 px-4 font-bold">الاسم بالإنجليزية</th>
                  <th className="py-3.5 px-4 font-bold">سعر الشحن للعميل</th>
                  <th className="py-3.5 px-4 font-bold">مدة التوصيل المتوقعة</th>
                  <th className="py-3.5 px-4 font-bold">الدفع كاش عند الاستلام</th>
                  <th className="py-3.5 px-4 font-bold text-center">تعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredZones.map((z) => (
                  <tr key={z.governorate} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="font-bold text-slate-900 text-sm">{z.governorate_ar || z.governorate}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] font-medium">
                      {z.governorate}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono font-extrabold text-slate-900 text-sm">
                        {z.shipping_rate}{' '}
                        <span className="text-[10px] font-sans text-amber-600 font-bold">ج.م</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1 font-mono font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>من {z.min_days} إلى {z.max_days} أيام عمل</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleCod(z)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                          z.cod_available
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            z.cod_available ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{z.cod_available ? 'مفعّل (كاش متاح)' : 'غير مفعّل'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(z)}
                        title="تعديل السعر ومدة التوصيل"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-slate-600" />
                        <span>تعديل</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. نافذة تعديل سعر محافظة محددة                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            dir="rtl"
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xl text-xs space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  تعديل شحن محافظة: {editingZone.governorate_ar || editingZone.governorate}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  سعر الشحن بالجنيه المصري (EGP) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">أقل عدد أيام (أيام عمل)</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinDays}
                    onChange={(e) => setEditMinDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">أقصى عدد أيام</label>
                  <input
                    type="number"
                    min="1"
                    value={editMaxDays}
                    onChange={(e) => setEditMaxDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">إتاحة الدفع كاش عند الاستلام (COD)</span>
                  <span className="text-[11px] text-slate-500 block">يسمح للعميل في هذه المحافظة بالدفع للمندوب</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCod}
                    onChange={(e) => setEditCod(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات لايف'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
