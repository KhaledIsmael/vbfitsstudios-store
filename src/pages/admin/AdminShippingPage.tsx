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
    await updateAdminShippingZone(editingZone.governorate, {
      shipping_rate: Number(editRate),
      min_days: Number(editMinDays),
      max_days: Number(editMaxDays),
      cod_available: Boolean(editCod)
    });

    setZones((prev) =>
      prev.map((z) =>
        z.governorate === editingZone.governorate
          ? {
              ...z,
              shipping_rate: Number(editRate),
              min_days: Number(editMinDays),
              max_days: Number(editMaxDays),
              cod_available: Boolean(editCod)
            }
          : z
      )
    );

    setSaving(false);
    setEditingZone(null);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 2500);
  };

  // Quick toggle COD
  const handleToggleCod = async (zone: AdminShippingZone) => {
    const nextCod = !zone.cod_available;
    setZones((prev) =>
      prev.map((z) => (z.governorate === zone.governorate ? { ...z, cod_available: nextCod } : z))
    );
    await updateAdminShippingZone(zone.governorate, {
      shipping_rate: zone.shipping_rate,
      min_days: zone.min_days,
      max_days: zone.max_days,
      cod_available: nextCod
    });
  };

  const filteredZones = zones.filter((z) => {
    if (codFilter === 'cod_enabled' && !z.cod_available) return false;
    if (codFilter === 'cod_disabled' && z.cod_available) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      z.governorate.toLowerCase().includes(q) ||
      (z.governorate_ar && z.governorate_ar.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-white">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة                                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              أسعار ومناطق الشحن بالمحافظات
            </h1>
            <AdminInfoTooltip
              title="إعدادات الشحن المصري"
              description="هنا يمكنك تحديد مصاريف الشحن بالجنيه المصري وعدد أيام التوصيل لكل محافظة في مصر (القاهرة، الجيزة، الإسكندرية، الصعيد، القناة، الدلتا). يتم احتساب التكلفة تلقائياً للعميل عند اختيار محافظته أثناء الشراء."
              tip="تفعيل الدفع عند الاستلام (COD) في القاهرة الكبرى والإسكندرية يضاعف المبيعات للبراندات الجديدة."
            />
          </div>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            اضبط تكلفة الشحن لكل محافظة ومدة التوصيل وتفعيل خيار الدفع كاش عند الاستلام.
          </p>
        </div>

        <button
          type="button"
          onClick={loadZones}
          disabled={loading}
          className="flex items-center gap-2 bg-[#16161B] hover:bg-white/10 text-white px-4 py-2 text-xs font-semibold border border-white/15 transition-colors rounded-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الأسعار</span>
        </button>
      </div>

      {/* Success alert */}
      {successToast && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>تم تحديث سعر الشحن ومدة التوصيل بنجاح على المتجر!</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. شريط البحث والفلترة                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#141418] p-3 sm:p-4 border border-white/10 rounded-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المحافظة (مثال: القاهرة، الإسكندرية، الجيزة)..."
            className="w-full bg-[#18181E] border border-white/10 rounded-sm pr-10 pl-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          {[
            { id: 'all', label: 'كل المحافظات' },
            { id: 'cod_enabled', label: 'الدفع عند الاستلام مفعّل' },
            { id: 'cod_disabled', label: 'الدفع الإلكتروني فقط' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCodFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-sm whitespace-nowrap text-xs font-medium transition-colors ${
                codFilter === tab.id
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. جدول المحافظات وأسعار الشحن                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#141418] border border-white/10 rounded-sm overflow-hidden">
        {filteredZones.length === 0 ? (
          <div className="p-12 text-center text-white/50">
            <Truck className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-sm font-semibold text-white/80">لم يتم العثور على محافظات مطابقة للبحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-white/5 text-white/60 font-mono text-[11px] uppercase border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">المحافظة / الإقليم</th>
                  <th className="py-3.5 px-4 font-semibold">المنطقة الجغرافية</th>
                  <th className="py-3.5 px-4 font-semibold">سعر الشحن للعميل</th>
                  <th className="py-3.5 px-4 font-semibold">مدة التوصيل المتوقعة</th>
                  <th className="py-3.5 px-4 font-semibold">الدفع كاش عند الاستلام</th>
                  <th className="py-3.5 px-4 font-semibold text-center">تعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredZones.map((z) => (
                  <tr key={z.governorate} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="font-bold text-white text-sm">{z.governorate_ar || z.governorate}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-white/70 font-mono text-[11px]">
                      {z.governorate}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        {z.shipping_rate}{' '}
                        <span className="text-[10px] font-sans text-amber-400">ج.م</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-white/80">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-white/40" />
                        <span>من {z.min_days} إلى {z.max_days} أيام عمل</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleCod(z)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                          z.cod_available
                            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-white/50 border border-white/10'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            z.cod_available ? 'bg-emerald-400' : 'bg-white/40'
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
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors inline-flex items-center gap-1 text-[11px]"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            dir="rtl"
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-sm p-6 shadow-2xl text-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  تعديل شحن محافظة: {editingZone.governorate}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="text-white/50 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-white/70 font-semibold mb-1">
                  سعر الشحن بالجنيه المصري (EGP) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">أقل عدد أيام (أيام عمل)</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinDays}
                    onChange={(e) => setEditMinDays(Number(e.target.value))}
                    className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">أقصى عدد أيام</label>
                  <input
                    type="number"
                    min="1"
                    value={editMaxDays}
                    onChange={(e) => setEditMaxDays(Number(e.target.value))}
                    className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#18181E] border border-white/10 rounded flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">إتاحة الدفع كاش عند الاستلام (COD)</span>
                  <span className="text-[11px] text-white/50 block">يسمح للعميل في هذه المحافظة بالدفع للمندوب</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCod}
                    onChange={(e) => setEditCod(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-white text-black font-bold rounded hover:bg-white/90 transition-colors shadow-md text-xs flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات لايف'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors text-xs"
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
