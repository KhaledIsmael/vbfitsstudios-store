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
import { sendTelegramOrderNotification } from '../../lib/adminIntegrations';
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
  ExternalLink,
  Bot,
  MessageCircle,
  BarChart3,
  Send,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const AdminMarketingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discounts' | 'banner' | 'integrations'>('discounts');

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

  // Free Integrations state (Telegram & Webhooks)
  const [telegramToken, setTelegramToken] = useState(
    () => localStorage.getItem('vbfits_telegram_bot_token') || ''
  );
  const [telegramChatId, setTelegramChatId] = useState(
    () => localStorage.getItem('vbfits_telegram_chat_id') || ''
  );
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ success: boolean; msg: string } | null>(null);

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

    const cleanCode = newCodeName.trim().toUpperCase().replace(/\s+/g, '');
    if (codes.some((c) => c.code.toUpperCase() === cleanCode)) {
      setFormError('هذا الكود موجود بالفعل.');
      return;
    }

    try {
      const res = await createDiscountCode({
        code: cleanCode,
        discount_type: newCodeType,
        discount_value: Number(newCodeValue),
        min_spend: Number(newCodeMinSpend) || 0,
        starts_at: new Date().toISOString(),
        expires_at: null,
        is_active: true
      });

      if (res.success && res.data) {
        setCodes((prev) => [res.data!, ...prev]);
        setModalOpen(false);
        setNewCodeName('');
        setNewCodeValue(15);
        setNewCodeMinSpend(0);
      } else {
        setFormError(res.error || 'تعذر إنشاء كود الخصم.');
      }
    } catch (err: any) {
      setFormError(err.message || 'تعذر إنشاء كود الخصم.');
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, current: boolean) => {
    await toggleDiscountCodeActive(id, !current);
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c)));
  };

  // Delete code
  const handleDeleteCode = async (id: string) => {
    if (!confirm('هل تريد حذف كود الخصم هذا نهائياً؟')) return;
    await deleteDiscountCode(id);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  // Copy code to clipboard
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Save Announcement Bar
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerSaved(false);
    const ok = await updateStorefrontAnnouncement(banner);
    if (ok) {
      setBannerSaved(true);
      setTimeout(() => setBannerSaved(false), 3000);
    }
  };

  // Save Telegram Config
  const handleSaveTelegram = () => {
    localStorage.setItem('vbfits_telegram_bot_token', telegramToken.trim());
    localStorage.setItem('vbfits_telegram_chat_id', telegramChatId.trim());
    setTelegramFeedback({ success: true, msg: 'تم حفظ إعدادات التيليجرام في المتصفح بنجاح!' });
    setTimeout(() => setTelegramFeedback(null), 3000);
  };

  // Send Test Telegram Alert
  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTelegramFeedback({ success: false, msg: 'يرجى إدخال Bot Token و Chat ID أولاً.' });
      return;
    }
    setTestingTelegram(true);
    setTelegramFeedback(null);

    const testOrder = {
      id: 'test-order-001',
      order_number: 'TEST-101',
      customer_name: 'تجربة إشعار تيليجرام',
      customer_phone: '01000000000',
      total: 1250,
      payment_method: 'COD',
      governorate: 'القاهرة',
      items: [{ product_name: 'Heavyweight Boxy Tee - Black', size: 'L', quantity: 2 }]
    } as any;

    const res = await sendTelegramOrderNotification(testOrder, {
      botToken: telegramToken.trim(),
      chatId: telegramChatId.trim()
    });

    setTestingTelegram(false);
    if (res.success) {
      setTelegramFeedback({ success: true, msg: 'تم إرسال إشعار تجريبي بنجاح إلى هاتفك عبر تيليجرام! 🎉' });
    } else {
      setTelegramFeedback({ success: false, msg: `فشل الإرسال: ${res.error}` });
    }
  };

  const filteredCodes = codes.filter((c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-slate-800">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة                                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              العروض وكوبونات الخصم والأتمتة
            </h1>
            <AdminInfoTooltip
              title="التسويق وأكواد الخصم"
              description="اصنع أكواد خصم مثل VB10 أو VIP15 لزيادة مبيعات متجرك وتوزيعها في حملات الإنفلونسرز على إنستجرام وتيك توك، وتحكم في الشريط الأسود الإعلاني أعلى الموقع."
              tip="كوبونات الخصم ذات النسبة المئوية البسيطة (10% إلى 15%) هي الأكثر فاعلية لتحفيز الشراء السريع."
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            أنشئ بروموكود لزبائنك، عدل الشريط الإعلاني المباشر، وفعّل إشعارات تيليجرام وواتساب المجانية.
          </p>
        </div>

        {activeTab === 'discounts' && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-zinc-950 text-white hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>إنشاء كود خصم جديد</span>
          </button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. أزرار التبديل بين التبويبات                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'discounts'
              ? 'bg-zinc-950 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-zinc-300" />
          <span>أكواد الخصم والبروموكود ({codes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'banner'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 text-sky-500" />
          <span>الشريط الإعلاني أعلى المتجر</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'integrations'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-emerald-500" />
          <span>التكاملات والأتمتة المجانية (تيليجرام / Vercel)</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. تبويب كوبونات الخصم                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="bg-white p-3 sm:p-4 border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم كود الخصم (مثال: VB10)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-zinc-900 focus:bg-white"
              />
            </div>
            <span className="text-xs text-slate-500 hidden sm:inline font-medium">
              الأكواد المفعلة تعمل مباشرة في صفحة الدفع للزبائن
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {filteredCodes.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Tag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700">لا توجد أكواد خصم حالياً</p>
                <p className="text-xs text-slate-400 mt-1">اضغط على زر (إنشاء كود خصم جديد) لإضافة كود مثل VB15 لزبائنك.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">كود الخصم</th>
                      <th className="py-3.5 px-4 font-bold">قيمة الخصم</th>
                      <th className="py-3.5 px-4 font-bold">الحد الأدنى للشراء</th>
                      <th className="py-3.5 px-4 font-bold">مرات الاستخدام</th>
                      <th className="py-3.5 px-4 font-bold">الحالة بالموقع</th>
                      <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCodes.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-slate-900 text-sm tracking-wider bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200">
                              {c.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.code)}
                              title="نسخ الكود"
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              {copiedCode === c.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {c.discount_type === 'percentage' ? (
                            <span className="text-emerald-700 font-mono text-sm font-extrabold">{c.discount_value}% خصم</span>
                          ) : (
                            <span className="text-emerald-700 font-mono text-sm font-extrabold">{c.discount_value} ج.م خصم ثابت</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-mono font-semibold">
                          {c.min_spend > 0 ? `${c.min_spend.toLocaleString()} ج.م` : 'بدون حد أدنى'}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {c.times_used || 0} مرة
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(c.id, c.is_active)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                              c.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.is_active ? 'bg-emerald-500' : 'bg-slate-400'
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
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-3xl space-y-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">
                الشريط الإعلاني أعلى صفحات المتجر (Announcement Bar)
              </h3>
              <AdminInfoTooltip
                title="الشريط الإعلاني"
                description="الشريط الذي يظهر في قمة الموقع لجميع الزوار على الهاتف والكمبيوتر. ممتاز لعرض عروض الشحن المجاني أو الإعلان عن كولكشن جديد."
                impact="النص المكتوب هنا يظهر مباشرة لكل زائر يدخل موقعك الآن."
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              يظهر هذا الشريط في أعلى المتجر للإعلان عن الشحن المجاني أو إطلاق كولكشن جديد أو كود خصم عام.
            </p>
          </div>

          {/* المعاينة الحية */}
          <div>
            <span className="text-[11px] font-mono text-slate-500 block mb-1.5 font-bold">معاينة مباشرة كيف سيظهر للزبون:</span>
            <div className="bg-zinc-950 border border-zinc-800 p-3 text-center text-xs font-mono text-white font-bold tracking-wider rounded-xl shadow-xs">
              {banner.enabled ? banner.text : <span className="text-zinc-500">الشريط الإعلاني مغلق حالياً ولا يظهر للزبائن</span>}
            </div>
          </div>

          <form onSubmit={handleSaveBanner} className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">إظهار الشريط الإعلاني بالموقع</span>
                <span className="text-[11px] text-slate-500 block">قم بتفعيله أثناء فترات العروض والحملات</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={banner.enabled}
                  onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">النص الإعلاني المعروض للزبائن *</label>
              <input
                type="text"
                value={banner.text}
                onChange={(e) => setBanner({ ...banner, text: e.target.value })}
                placeholder="مثال: شحن مجاني لجميع المحافظات بمناسبة الصيف"
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">الرابط عند الضغط على الإعلان</label>
              <input
                type="text"
                value={banner.link || '/shop'}
                onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                placeholder="/shop"
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:border-zinc-900 focus:bg-white"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-3 bg-zinc-950 text-white font-bold text-xs rounded-xl hover:bg-zinc-800 transition-all shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4 text-white" />
                <span>حفظ ونشر الإعلان لايف على المتجر</span>
              </button>

              {bannerSaved && (
                <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  تم الحفظ بنجاح وتحديث المتجر المباشر!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. تبويب التكاملات والأتمتة المجانية (Telegram / Vercel)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6 max-w-4xl">
          {/* Card 1: Telegram Order Alerts (Free Webhook) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-sky-500" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    إشعارات الطلبات الفورية عبر تليجرام (Telegram Instant Alerts - مجاني 100%)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  يصلك إشعار فوري على تليفونك أول ما زبون يطلب أي أوردر على المتجر (باسم العميل، رقمه، القطع، وإجمالي الفلوس بالجنيه).
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold whitespace-nowrap">
                مجاني للأبد
              </span>
            </div>

            {telegramFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  telegramFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {telegramFeedback.msg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Telegram Bot Token (من BotFather)
                </label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Telegram Chat ID (معرف محادثتك)
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="مثال: 987654321"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveTelegram}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                حفظ الإعدادات
              </button>

              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {testingTelegram ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>إرسال إشعار تجريبي لهاتفي</span>
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">💡 كيف تحصل على الـ Bot Token والـ Chat ID مجاناً في دقيقتين؟</p>
              <p>1. افتح تيليجرام وابحث عن <b>@BotFather</b> واكتب <code>/newbot</code> وسمّيه باسم براندك واحصل على الـ Token.</p>
              <p>2. ابحث عن <b>@userinfobot</b> واضغط Start لمعرفة الـ <b>Id</b> الخاص بحسابك والصقه في خانة Chat ID أعلاه.</p>
            </div>
          </div>

          {/* Card 2: Vercel Analytics & Speed Insights */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    أدوات Vercel المجانية لمراقبة أداء وزوار المتجر
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  يمكنك تفعيل <b>Vercel Analytics</b> و <b>Speed Insights</b> بضغطة زر مجاناً من لوحة تحكم Vercel لمعرفة عدد زوار المتجر وأسرع الصفحات بدون كتابة أي كود إضافي.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-extrabold whitespace-nowrap">
                Vercel Free
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">خطوات التفعيل المجانية على Vercel:</p>
              <p>1. ادخل على لوحة تحكم Vercel لمشروعك (<b>vbfitsstudois-store</b>).</p>
              <p>2. اضغط على تبويب <b>Analytics</b> ثم اضغط <b>Enable</b>.</p>
              <p>3. اضغط على تبويب <b>Speed Insights</b> ثم اضغط <b>Enable</b>.</p>
              <p className="text-[11px] text-slate-500">سيبدأ Vercel فورياً في تسجيل حركة الزوار وسرعة تحميل متجرك من مصر والدول الأخرى مجاناً.</p>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. نافذة منبثقة لإنشاء كود خصم جديد                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            dir="rtl"
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xl text-xs space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-900" />
                <h3 className="text-sm font-extrabold text-slate-900">إنشاء كود خصم جديد للبراند</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePromo} className="space-y-3.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم الكود (البروموكود) *</label>
                <input
                  type="text"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                  placeholder="مثال: VB15 أو VIP2026 أو SUMMER10"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold tracking-wider focus:outline-none focus:border-zinc-900 focus:bg-white uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع الخصم</label>
                  <select
                    value={newCodeType}
                    onChange={(e) => setNewCodeType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-zinc-900 focus:bg-white"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {newCodeType === 'percentage' ? 'نسبة الخصم (%)' : 'قيمة الخصم (ج.م)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCodeValue}
                    onChange={(e) => setNewCodeValue(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:border-zinc-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الحد الأدنى للشراء بالجنيه (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  value={newCodeMinSpend}
                  onChange={(e) => setNewCodeMinSpend(Number(e.target.value))}
                  placeholder="0 (بدون حد أدنى)"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-zinc-900 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  مثال: اتركه 0 إذا كان الخصم يعمل على أي طلب مهما كانت قيمته.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-800 text-white font-bold rounded-xl transition-colors shadow-md text-xs cursor-pointer"
                >
                  تفعيل وحفظ الكود
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
