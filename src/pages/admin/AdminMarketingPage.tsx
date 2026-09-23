import React, { useState, useEffect } from 'react';
import {
  fetchDiscountCodes,
  createDiscountCode,
  toggleDiscountCodeActive,
  deleteDiscountCode,
  getStorefrontAnnouncement,
  updateStorefrontAnnouncement,
  type DiscountCode,
  type StoreAnnouncement
} from '../../lib/adminMarketing';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import {
  Sparkles,
  Tag,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Percent,
  CheckCircle2,
  Save,
  Megaphone,
  Copy,
  ExternalLink
} from 'lucide-react';

export const AdminMarketingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discounts' | 'banner'>('discounts');

  // Discounts state
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New Code Form State
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeType, setNewCodeType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCodeValue, setNewCodeValue] = useState(15);
  const [newCodeMinSpend, setNewCodeMinSpend] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Announcement Banner state
  const [banner, setBanner] = useState<StoreAnnouncement>({
    enabled: true,
    text: 'شحن مجاني على جميع الطلبات فوق 1,500 ج.م لجميع محافظات مصر بمناسبة الإطلاق',
    link: '/shop'
  });
  const [bannerSaved, setBannerSaved] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [codesData, bannerData] = await Promise.all([
        fetchDiscountCodes(),
        getStorefrontAnnouncement()
      ]);
      setCodes(codesData);
      if (bannerData) setBanner(bannerData);
    } catch (err) {
      console.error('Failed to load marketing assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Handle Create Promo Code
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newCodeName.trim()) {
      setFormError('يرجى إدخال كود الخصم (مثال: VB10).');
      return;
    }

    const { success, data, error } = await createDiscountCode({
      code: newCodeName.trim().toUpperCase(),
      discount_type: newCodeType,
      discount_value: Number(newCodeValue),
      min_spend: Number(newCodeMinSpend),
      max_uses: null,
      expires_at: null,
      starts_at: new Date().toISOString(),
      is_active: true
    });

    if (!success || !data) {
      setFormError(error || 'فشل إنشاء الكود، قد يكون الاسم مستخدماً بالفعل.');
      return;
    }

    setCodes([data, ...codes]);
    setModalOpen(false);
    setNewCodeName('');
    setNewCodeValue(15);
    setNewCodeMinSpend(0);
  };

  // Toggle active status
  const handleToggleActive = async (id: string, current: boolean) => {
    const nextVal = !current;
    setCodes(codes.map((c) => (c.id === id ? { ...c, is_active: nextVal } : c)));
    await toggleDiscountCodeActive(id, nextVal);
  };

  // Delete code
  const handleDeleteCode = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكود نهائياً؟')) return;
    setCodes(codes.filter((c) => c.id !== id));
    await deleteDiscountCode(id);
  };

  // Save Announcement
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStorefrontAnnouncement(banner);
    setBannerSaved(true);
    setTimeout(() => setBannerSaved(false), 2500);
  };

  // Copy code to clipboard
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const filteredCodes = codes.filter((c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-white">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              العروض وكوبونات الخصم
            </h1>
            <AdminInfoTooltip
              title="الخصومات وإعلانات المتجر"
              description="هنا يمكنك إنشاء بروموكود للعملاء والإنفلونسرز (مثال: خصم 15% أو خصم 100 جنيه)، وتعديل الشريط الإعلاني الأسود الذي يظهر أعلى صفحة المتجر لجذب الزوار."
              tip="كوبونات الخصم ترفع معدل الشراء بنسبة تصل إلى 35% خصوصاً عند إطلاق كولكشن جديد."
            />
          </div>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            أنشئ أكواد الخصم للإنفلونسرز والزبائن، وعدّل الشريط الإعلاني أعلى الموقع في ثوانٍ.
          </p>
        </div>

        {activeTab === 'discounts' && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 text-xs font-bold rounded-sm transition-all shadow-md self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>إنشاء كود خصم جديد</span>
          </button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. التبويبات الأساسية                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-sm transition-all ${
            activeTab === 'discounts'
              ? 'bg-amber-400 text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>كوبونات وأكواد الخصم ({codes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-sm transition-all ${
            activeTab === 'banner'
              ? 'bg-amber-400 text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>الشريط الإعلاني أعلى المتجر (Banner)</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. تبويب كوبونات الخصم                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="bg-[#141418] p-3 sm:p-4 border border-white/10 rounded-sm flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم كود الخصم (مثال: VB10)..."
                className="w-full bg-[#18181E] border border-white/10 rounded-sm pr-10 pl-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
              />
            </div>
            <span className="text-xs text-white/50 hidden sm:inline">
              الأكواد المفعلة تعمل مباشرة في صفحة الدفع للزبائن
            </span>
          </div>

          <div className="bg-[#141418] border border-white/10 rounded-sm overflow-hidden">
            {filteredCodes.length === 0 ? (
              <div className="p-12 text-center text-white/50">
                <Tag className="w-10 h-10 mx-auto text-white/20 mb-3" />
                <p className="text-sm font-semibold text-white/80">لا توجد أكواد خصم حالياً</p>
                <p className="text-xs text-white/40 mt-1">اضغط على زر (إنشاء كود خصم جديد) لإضافة كود مثل VB15 لزبائنك.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-white/5 text-white/60 font-mono text-[11px] uppercase border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">كود الخصم</th>
                      <th className="py-3.5 px-4 font-semibold">قيمة الخصم</th>
                      <th className="py-3.5 px-4 font-semibold">الحد الأدنى للشراء</th>
                      <th className="py-3.5 px-4 font-semibold">مرات الاستخدام</th>
                      <th className="py-3.5 px-4 font-semibold">الحالة بالموقع</th>
                      <th className="py-3.5 px-4 font-semibold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCodes.map((c) => (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300 text-sm tracking-wider bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20">
                              {c.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.code)}
                              title="نسخ الكود"
                              className="text-white/40 hover:text-white p-1"
                            >
                              {copiedCode === c.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-white">
                          {c.discount_type === 'percentage' ? (
                            <span className="text-emerald-400 font-mono text-sm">{c.discount_value}% خصم</span>
                          ) : (
                            <span className="text-emerald-400 font-mono text-sm">{c.discount_value} ج.م خصم ثابت</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-white/70 font-mono">
                          {c.min_spend > 0 ? `${c.min_spend.toLocaleString()} ج.م` : 'بدون حد أدنى'}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-white/80">
                          {c.times_used || 0} مرة
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(c.id, c.is_active)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                              c.is_active
                                ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/5 text-white/50 border border-white/10'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.is_active ? 'bg-emerald-400' : 'bg-white/40'
                              }`}
                            />
                            <span>{c.is_active ? 'مفعل ويعمل للزبائن' : 'معطل وموقوف'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCode(c.id)}
                            title="حذف الكود"
                            className="p-1.5 bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. تبويب الشريط الإعلاني (Announcement Bar)                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'banner' && (
        <div className="bg-[#141418] border border-white/10 rounded-sm p-6 max-w-3xl space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                الشريط الإعلاني أعلى صفحات المتجر (Announcement Bar)
              </h3>
              <AdminInfoTooltip
                title="الشريط الإعلاني"
                description="الشريط الرفيع الذي يظهر في قمة الموقع لجميع الزوار على الهاتف والكمبيوتر. ممتاز لعرض عروض الشحن المجاني أو الإعلان عن كولكشن جديد."
                impact="النص المكتوب هنا يظهر مباشرة لكل زائر يدخل موقعك الآن."
              />
            </div>
            <p className="text-xs text-white/60 mt-1">
              يظهر هذا الشريط في أعلى المتجر للإعلان عن الشحن المجاني أو إطلاق كولكشن جديد أو كود خصم عام.
            </p>
          </div>

          {/* المعاينة الحية */}
          <div>
            <span className="text-[11px] font-mono text-white/50 block mb-1.5">معاينة مباشرة كيف سيظهر للزبون:</span>
            <div className="bg-black border border-white/20 p-2.5 text-center text-xs font-mono text-amber-300 tracking-wider rounded">
              {banner.enabled ? banner.text : <span className="text-white/40">الشريط الإعلاني مغلق حالياً ولا يظهر للزبائن</span>}
            </div>
          </div>

          <form onSubmit={handleSaveBanner} className="space-y-4 text-xs">
            <div className="p-3 bg-[#18181E] border border-white/10 rounded flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">إظهار الشريط الإعلاني بالموقع</span>
                <span className="text-[11px] text-white/50 block">قم بتفعيله أثناء فترات العروض والحملات</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={banner.enabled}
                  onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1">النص الإعلاني المعروض للزبائن *</label>
              <input
                type="text"
                value={banner.text}
                onChange={(e) => setBanner({ ...banner, text: e.target.value })}
                placeholder="مثال: شحن مجاني لجميع المحافظات بمناسبة الصيف"
                className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400 font-sans"
              />
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1">الرابط عند الضغط على الإعلان</label>
              <input
                type="text"
                value={banner.link || '/shop'}
                onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                placeholder="/shop"
                className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-xs rounded hover:bg-white/90 transition-all shadow-md"
              >
                <Save className="w-4 h-4 text-black" />
                <span>حفظ ونشر الإعلان لايف على المتجر</span>
              </button>

              {bannerSaved && (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  تم الحفظ بنجاح وتحديث المتجر المباشر!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. نافذة منبثقة لإنشاء كود خصم جديد                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            dir="rtl"
            className="w-full max-w-md bg-[#141418] border border-white/15 rounded-sm p-6 shadow-2xl text-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">إنشاء كود خصم جديد للبراند</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-white/50 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500/30 text-red-300 rounded text-[11px] font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePromo} className="space-y-3.5">
              <div>
                <label className="block text-white/70 font-semibold mb-1">اسم الكود (البروموكود) *</label>
                <input
                  type="text"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                  placeholder="مثال: VB15 أو VIP2026 أو SUMMER10"
                  className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white font-mono font-bold tracking-wider focus:outline-none focus:border-amber-400 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 font-semibold mb-1">نوع الخصم</label>
                  <select
                    value={newCodeType}
                    onChange={(e) => setNewCodeType(e.target.value as any)}
                    className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">
                    {newCodeType === 'percentage' ? 'نسبة الخصم (%)' : 'قيمة الخصم (ج.م)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCodeValue}
                    onChange={(e) => setNewCodeValue(Number(e.target.value))}
                    className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-semibold mb-1">الحد الأدنى للشراء بالجنيه (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  value={newCodeMinSpend}
                  onChange={(e) => setNewCodeMinSpend(Number(e.target.value))}
                  placeholder="0 (بدون حد أدنى)"
                  className="w-full bg-[#18181E] border border-white/15 p-2 rounded text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-white/40 block mt-0.5">
                  مثال: اتركه 0 إذا كان الخصم يعمل على أي طلب مهما كانت قيمته.
                </span>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded transition-colors shadow-md text-xs"
                >
                  تفعيل وحفظ الكود
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
