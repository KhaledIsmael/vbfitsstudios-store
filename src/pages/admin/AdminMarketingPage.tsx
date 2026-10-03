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
import { supabase } from '../../lib/supabaseClient';
import { sendSms } from '../../lib/sms';
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
  AlertCircle,
  Clock,
  Timer,
  Eye,
  RefreshCw,
  Image
} from 'lucide-react';
import { BRAND_CONFIG } from '../../config/assets';
import {
  getSiteSettings,
  updateSiteSettings,
  setPastGate,
  calculateCountdown,
  DEFAULT_LAUNCH_AT,
  DEFAULT_SITE_SETTINGS,
  formatCairoIso,
  toDatetimeLocal,
  getCairoTzOffset,
  type SiteSettings
} from '../../lib/siteSettings';

import { AdminHeroEditor } from '../../components/admin/AdminHeroEditor';

export const AdminMarketingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discounts' | 'hero' | 'banner' | 'launch' | 'integrations'>('hero');

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

  // Pre-Launch Gate & SNKRS Drop state
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [siteSettingsSaved, setSiteSettingsSaved] = useState(false);
  const [resetGateFeedback, setResetGateFeedback] = useState<string | null>(null);

  // Free Integrations state (Telegram & Webhooks)
  const [telegramToken, setTelegramToken] = useState(
    () => localStorage.getItem('vbfits_telegram_bot_token') || ''
  );
  const [telegramChatId, setTelegramChatId] = useState(
    () => localStorage.getItem('vbfits_telegram_chat_id') || ''
  );
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [broadcastingSms, setBroadcastingSms] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [codesData, bannerData, siteSettingsData] = await Promise.all([
        fetchDiscountCodes(),
        getStorefrontAnnouncement(),
        getSiteSettings()
      ]);
      setCodes(codesData);
      if (bannerData) setBanner(bannerData);
      if (siteSettingsData) setSiteSettings(siteSettingsData);
    } catch (err) {
      console.error('Failed to load marketing assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Save Launch Settings
  const handleSaveSiteSettings = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setSiteSettingsSaved(false);
    const res = await updateSiteSettings(siteSettings);
    if (res.success) {
      setSiteSettingsSaved(true);
      setTimeout(() => setSiteSettingsSaved(false), 4000);
    }
  };

  // Test First Visit / Reset Gate
  const handleResetGate = () => {
    setPastGate(false);
    setResetGateFeedback('تمت إعادة ضبط البوابة بنجاح! عند فتح المتجر، ستظهر شاشة العد التنازلي كأول زيارة.');
    setTimeout(() => setResetGateFeedback(null), 4000);
  };

  const toDatetimeInput = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '2026-10-10T00:00';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '2026-10-10T00:00';
    }
  };

  const fromDatetimeInput = (val: string) => {
    if (!val) return DEFAULT_LAUNCH_AT;
    return `${val}:00+03:00`;
  };

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

  // Broadcast SMS
  const handleBroadcastSMS = async (code: DiscountCode) => {
    if (!confirm(`هل أنت متأكد أنك تريد إرسال رسائل نصية قصيرة SMS لجميع العملاء بخصوص كود الخصم ${code.code}؟`)) return;
    setBroadcastingSms(code.id);
    try {
      // 1. Fetch waitlist and customers
      const { data: waitlist } = await supabase.from('waitlist_signups').select('phone').not('phone', 'is', null);
      const { data: customers } = await supabase.from('customers').select('phone').not('phone', 'is', null);
      
      const phones = new Set<string>();
      if (waitlist) waitlist.forEach(w => { if (w.phone) phones.add(w.phone); });
      if (customers) customers.forEach(c => { if (c.phone) phones.add(c.phone); });

      const discountVal = code.discount_type === 'percentage' ? `${code.discount_value}%` : `${code.discount_value} EGP`;
      const message = `عروض VB Fits! استخدم كود الخصم ${code.code} للحصول على خصم ${discountVal}. تسوق الآن!`;

      for (const phone of phones) {
        await sendSms(phone, message);
      }
      
      alert(`تم بنجاح إرسال عرض ${code.code} إلى ${phones.size} عميل عبر SMS.`);
    } catch (e: any) {
      alert(`حدث خطأ أثناء إرسال الرسائل: ${e.message}`);
    } finally {
      setBroadcastingSms(null);
    }
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
          <span>الشريط الإعلاني</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'hero'
              ? 'bg-zinc-950 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Image className="w-3.5 h-3.5 text-purple-400" />
          <span>Hero Banners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('launch')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'launch'
              ? 'bg-zinc-950 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Launch Countdown</span>
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleBroadcastSMS(c)}
                              disabled={broadcastingSms === c.id}
                              title="إرسال عبر SMS"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {broadcastingSms === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCode(c.id)}
                              title="حذف الكود"
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
      {/* 3B. تبويب Hero Banners                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'hero' && (
        <AdminHeroEditor />
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
      {/* 4. تبويب Launch Countdown (بوابة الإطلاق والعد التنازلي)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'launch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* العمود الأيسر: نموذج الإعدادات (Form Column) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    إعدادات Launch Countdown & Pre-Launch Gate
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  تحكم في موعد الإطلاق الرسمي وتفعيل بوابة الشاشة الكاملة (site_settings.countdown_gate_enabled) ونصوص التشويق. جميع التعديلات تُحفظ في جدول <code>site_settings</code> وتنعكس فوراً على المتجر المباشر بدون الحاجة لإعادة الرفع (Zero Redeploy).
                </p>
              </div>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-extrabold whitespace-nowrap flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Live Sync</span>
              </span>
            </div>

            {resetGateFeedback && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold animate-fade-in flex items-center justify-between">
                <span>{resetGateFeedback}</span>
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-emerald-900 hover:text-black text-[11px]"
                >
                  فتح المتجر الآن للاختبار ↗
                </a>
              </div>
            )}

            <form onSubmit={handleSaveSiteSettings} className="space-y-6 text-xs">
              {/* 1. موعد وتاريخ الإطلاق الرسمي (launch_at) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-extrabold text-slate-900 block text-xs">
                      موعد وتاريخ الإطلاق الرسمي (site_settings.launch_at) *
                    </label>
                    <span className="text-[11px] text-slate-500 block">
                      المنطقة الزمنية: <b>Africa/Cairo ({getCairoTzOffset(new Date(siteSettings.launch_at))})</b>
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-white px-2.5 py-1 border border-slate-200 text-slate-600 rounded">
                    القيمة المحفوظة: {siteSettings.launch_at}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <input
                    type="datetime-local"
                    value={toDatetimeLocal(siteSettings.launch_at)}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        launch_at: formatCairoIso(e.target.value)
                      })
                    }
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-zinc-900"
                  />

                  {/* اختصارات سريعة للموعد */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSiteSettings({
                          ...siteSettings,
                          launch_at: DEFAULT_LAUNCH_AT
                        })
                      }
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      الافتراضي: 10-10-2026 (Cairo)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const in24h = new Date(Date.now() + 24 * 3600 * 1000);
                        setSiteSettings({
                          ...siteSettings,
                          launch_at: formatCairoIso(toDatetimeLocal(in24h.toISOString()))
                        });
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      +24 ساعة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const in3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000);
                        setSiteSettings({
                          ...siteSettings,
                          launch_at: formatCairoIso(toDatetimeLocal(in3Days.toISOString()))
                        });
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      +3 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
                        setSiteSettings({
                          ...siteSettings,
                          launch_at: formatCairoIso(toDatetimeLocal(in7Days.toISOString()))
                        });
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      +7 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSiteSettings({ ...siteSettings, launch_at: '2026-09-01T00:00:00+03:00' });
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-[10px] font-bold text-rose-700 transition-colors cursor-pointer"
                      title="يحاكي انتهاء موعد الإطلاق وفتح المتجر للجميع فوراً"
                    >
                      انتهى موعد الإطلاق (المتجر مفتوح)
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. عنوان التشويق الرئيسي (Teaser Headline) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  عنوان التشويق الرئيسي (site_settings.teaser_headline) *
                </label>
                <input
                  type="text"
                  value={siteSettings.teaser_headline || ''}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, teaser_headline: e.target.value })
                  }
                  placeholder="مثال: THE ARCHIVAL VAULT OPENS SOON"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-zinc-900 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  يظهر بخط كبير وواضح أعلى عداد الأيام والساعات.
                </span>
              </div>

              {/* 3. النص الفرعي للتشويق (Teaser Subtext) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  النص الفرعي للتشويق (site_settings.teaser_subtext)
                </label>
                <input
                  type="text"
                  value={siteSettings.teaser_subtext || ''}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, teaser_subtext: e.target.value })
                  }
                  placeholder="مثال: SECURE EARLY ATELIER ACCESS & PRIVATE VIP DROP DISPATCHES"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-zinc-900 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  نص توضيحي إضافي يظهر أسفل العنوان الرئيسي مباشرة.
                </span>
              </div>

              {/* 4. مفتاح On/Off لبوابة الشاشة الكاملة (countdown_gate_enabled) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    تفعيل بوابة الشاشة الكاملة (site_settings.countdown_gate_enabled)
                  </span>
                  <span className="text-[11px] text-slate-500 block max-w-md">
                    عند التفعيل، تظهر شاشة سوداء كاملة باللوجو والعد التنازلي ونموذج الاشتراك للزوار الجدد حتى حلول موعد الإطلاق.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettings.countdown_gate_enabled}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        countdown_gate_enabled: e.target.checked,
                        gate_enabled: e.target.checked
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-950"></div>
                </label>
              </div>

              {/* 5. مفتاح On/Off لشريط العد التنازلي أعلى الهيدر */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    تثبيت شريط الـ Drop بأسلوب Nike-SNKRS أعلى الهيدر (Countdown Strip)
                  </span>
                  <span className="text-[11px] text-slate-500 block max-w-md">
                    شريط أسود مدمج يظهر أعلى الهيدر في كل الصفحات في فترة ما قبل الإطلاق.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettings.countdown_strip_enabled}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        countdown_strip_enabled: e.target.checked
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-950"></div>
                </label>
              </div>

              {/* 6. نص شريط العد التنازلي */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  نص شريط العد التنازلي (Countdown Strip Announcement)
                </label>
                <input
                  type="text"
                  value={siteSettings.countdown_strip_text || ''}
                  onChange={(e) =>
                    setSiteSettings({
                      ...siteSettings,
                      countdown_strip_text: e.target.value
                    })
                  }
                  placeholder="مثال: OFFICIAL LAUNCH INCOMING · WORLDWIDE DROP"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-zinc-900 focus:bg-white"
                />
              </div>

              {/* أزرار الحفظ والإجراءات */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  id="save-launch-settings-btn"
                  onClick={handleSaveSiteSettings}
                  className="flex items-center gap-2 px-5 py-3 bg-zinc-950 text-white font-bold text-xs rounded-xl hover:bg-zinc-800 transition-all shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4 text-white" />
                  <span>حفظ إعدادات الإطلاق وتطبيقها لايف</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetGate}
                  className="flex items-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  title="يمسح علامة التخطي past_gate من المتصفح لتجربة شاشة العد التنازلي كأنك زائر جديد"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط أول زيارة (اختبار QA)</span>
                </button>

                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة المتجر المباشر</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                {siteSettingsSaved && (
                  <span className="text-emerald-700 text-xs font-bold flex items-center gap-1 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    تم الحفظ بنجاح وتحديث المتجر فوراً!
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* العمود الأيمن: معاينة حية مباشرة لبطاقة العد التنازلي (Live Preview Card) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="bg-[#08080B] border border-white/15 rounded-2xl p-5 sm:p-6 text-white font-mono shadow-2xl relative overflow-hidden select-none">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Preview Card Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-bold tracking-widest uppercase">LIVE PREVIEW</span>
                </div>
                <span className="text-white/50 tracking-wider">
                  Africa/Cairo ({getCairoTzOffset(new Date(siteSettings.launch_at))})
                </span>
              </div>

              {/* Status Badge */}
              <div className="pt-4 flex items-center justify-between">
                <span
                  className={`px-2.5 py-1 text-[9px] uppercase tracking-widest font-bold border ${
                    siteSettings.countdown_gate_enabled
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {siteSettings.countdown_gate_enabled ? '● Full-Screen Gate: Active' : '○ Gate: Disabled'}
                </span>

                <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">
                  {calculateCountdown(siteSettings.launch_at).isPassed ? 'Drop Live' : 'Countdown Active'}
                </span>
              </div>

              {/* Logo */}
              <div className="pt-6 pb-2 text-center">
                <img
                  src={BRAND_CONFIG.logo.light || '/assets/logo/logo-light.png'}
                  alt="VB FITS"
                  className="h-8 sm:h-9 w-auto object-contain mx-auto filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                />
              </div>

              {/* Teaser Headline and Subtext */}
              <div className="text-center space-y-1.5 pt-3 pb-5">
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white">
                  {siteSettings.teaser_headline || 'THE ARCHIVAL VAULT OPENS SOON'}
                </h4>
                {siteSettings.teaser_subtext && (
                  <p className="text-[10px] sm:text-[11px] text-white/65 uppercase tracking-wider leading-relaxed px-2 font-sans">
                    {siteSettings.teaser_subtext}
                  </p>
                )}
              </div>

              {/* Live Countdown 4-block display */}
              <div className="grid grid-cols-4 gap-2 text-center py-2 select-none">
                {(() => {
                  const c = calculateCountdown(siteSettings.launch_at);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  return (
                    <>
                      <div className="bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                        <div className="text-xl sm:text-2xl font-black text-white">{pad(c.days)}</div>
                        <div className="text-[8px] sm:text-[9px] text-white/40 uppercase mt-0.5 tracking-wider">DAYS</div>
                      </div>
                      <div className="bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                        <div className="text-xl sm:text-2xl font-black text-white">{pad(c.hours)}</div>
                        <div className="text-[8px] sm:text-[9px] text-white/40 uppercase mt-0.5 tracking-wider">HOURS</div>
                      </div>
                      <div className="bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                        <div className="text-xl sm:text-2xl font-black text-white">{pad(c.minutes)}</div>
                        <div className="text-[8px] sm:text-[9px] text-white/40 uppercase mt-0.5 tracking-wider">MIN</div>
                      </div>
                      <div className="bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                        <div className="text-xl sm:text-2xl font-black text-amber-300">{pad(c.seconds)}</div>
                        <div className="text-[8px] sm:text-[9px] text-white/40 uppercase mt-0.5 tracking-wider">SEC</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Mock Notify Me Input inside Preview */}
              <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[9px] text-white/50 uppercase">
                  <span>Notify Me Form</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-white text-black font-bold">Email</span>
                    <span className="px-1.5 py-0.5 text-white/40">WhatsApp</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/60 border border-white/15 px-2.5 py-2 text-[10px] text-white/40">
                    name@domain.com
                  </div>
                  <div className="bg-white text-black font-bold text-[9px] uppercase px-3 py-2 flex items-center">
                    Notify Me
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview: Header Countdown Strip Variant */}
            <div className="bg-[#09090D] border border-white/15 rounded-xl p-3 text-white font-mono text-[10px] shadow-lg space-y-1.5">
              <div className="flex items-center justify-between text-white/50 text-[9px] uppercase border-b border-white/10 pb-1">
                <span>Strip Variant (Pinned Above Header)</span>
                <span className={siteSettings.countdown_strip_enabled ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                  {siteSettings.countdown_strip_enabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>SNKRS DROP</span>
                </div>
                <div className="truncate text-white/70 text-[9px]">
                  {siteSettings.countdown_strip_text || 'OFFICIAL LAUNCH INCOMING'}
                </div>
                <div className="text-amber-300 font-bold bg-black/70 px-1.5 py-0.5 border border-white/10">
                  {(() => {
                    const c = calculateCountdown(siteSettings.launch_at);
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${pad(c.days)}D : ${pad(c.hours)}H : ${pad(c.minutes)}M`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
