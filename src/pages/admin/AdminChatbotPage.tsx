import React, { useState, useEffect, useRef } from 'react';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import {
  getChatbotFaqs,
  getFaqCategories,
  upsertChatbotFaq,
  deleteChatbotFaq,
  updateFaqsOrder,
  getChatbotLogs,
  type ChatbotFaq,
  type ChatbotLog,
} from '../../lib/chatbot';

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEdit = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IconGrip = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg>;
const IconSave = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IconX = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconRefresh = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>;
const IconSearch = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/></svg>;
const IconBot = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 7V3"/><circle cx="12" cy="5" r="2"/><path d="M8 11V9a4 4 0 018 0v2"/><line x1="9" y1="16" x2="9.01" y2="16"/><line x1="15" y1="16" x2="15.01" y2="16"/></svg>;
const IconList = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IconTag = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IconChevronUp = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>;
const IconChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;

// ─── Drag State ───────────────────────────────────────────────────────────────
interface DragState {
  draggingId: string | null;
  overIndex: number | null;
}

// ─── FAQ Form Component ───────────────────────────────────────────────────────
interface FaqFormProps {
  initial?: Partial<ChatbotFaq>;
  categories: string[];
  onSave: (faq: Partial<ChatbotFaq>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const FaqForm: React.FC<FaqFormProps> = ({ initial, categories, onSave, onCancel, saving }) => {
  const [question, setQuestion] = useState(initial?.question || '');
  const [answer, setAnswer] = useState(initial?.answer || '');
  const [category, setCategory] = useState(initial?.category || (categories[0] || 'عام'));
  const [newCategory, setNewCategory] = useState('');
  const [keywords, setKeywords] = useState<string[]>(initial?.trigger_keywords || []);
  const [kwInput, setKwInput] = useState('');
  const [isActive, setIsActive] = useState(initial?.is_active !== false);
  const [useNewCategory, setUseNewCategory] = useState(false);

  const handleAddKw = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKwInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    const finalCategory = useNewCategory ? (newCategory.trim() || 'عام') : category;
    await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      question: question.trim(),
      answer: answer.trim(),
      category: finalCategory,
      trigger_keywords: keywords,
      is_active: isActive,
      display_order: initial?.display_order ?? 999,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Category */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <IconTag /> التصنيف
        </label>
        <div className="flex gap-2">
          {!useNewCategory ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 bg-white border border-slate-200 text-slate-900 text-xs font-medium rounded-lg px-3 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              dir="rtl"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="اسم التصنيف الجديد..."
              className="flex-1 bg-white border border-slate-200 text-slate-900 text-xs font-medium rounded-lg px-3 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder-slate-400"
              dir="rtl"
            />
          )}
          <button
            type="button"
            onClick={() => setUseNewCategory(!useNewCategory)}
            className="px-4 py-2 text-[10px] font-bold border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors uppercase tracking-wider whitespace-nowrap"
          >
            {useNewCategory ? 'تصنيف موجود' : 'تصنيف جديد'}
          </button>
        </div>
      </div>

      {/* Question */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">السؤال</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          placeholder="أدخل السؤال هنا..."
          className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg px-3 py-3 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder-slate-400"
          dir="rtl"
        />
      </div>

      {/* Answer */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">الإجابة</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
          rows={4}
          placeholder="أدخل الإجابة الكاملة هنا..."
          className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-3 py-3 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder-slate-400 resize-none leading-relaxed"
          dir="rtl"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <IconTag /> كلمات التشغيل (Keywords)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKw(); } }}
            placeholder="أضف كلمة مفتاحية..."
            className="flex-1 bg-white border border-slate-200 text-slate-900 text-xs font-medium rounded-lg px-3 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder-slate-400"
            dir="rtl"
          />
          <button
            type="button"
            onClick={handleAddKw}
            className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors shadow-xs"
          >
            <IconPlus />
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            {keywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-full shadow-xs">
                {kw}
                <button type="button" onClick={() => setKeywords(keywords.filter((k) => k !== kw))} className="text-slate-400 hover:text-red-500 transition-colors">
                  <IconX />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={`relative w-11 h-6 rounded-full transition-colors shadow-inner ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isActive ? 'right-0.5' : 'left-0.5'}`} />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          {isActive ? 'نشط (يعمل)' : 'مخفي (لا يظهر للعملاء)'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button
          type="submit"
          disabled={saving || !question.trim() || !answer.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 shadow"
        >
          <IconSave />
          {saving ? 'جاري الحفظ...' : (initial?.id ? 'حفظ التعديلات' : 'إضافة السؤال')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors shadow-xs"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
};

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export const AdminChatbotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'faqs' | 'logs'>('faqs');
  const [faqs, setFaqs] = useState<ChatbotFaq[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<(ChatbotLog & { chatbot_faqs?: { question: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI states
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Drag state
  const [drag, setDrag] = useState<DragState>({ draggingId: null, overIndex: null });
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    if (activeTab === 'faqs') {
      const data = await getChatbotFaqs(false);
      setFaqs(data);
      setCategories(getFaqCategories(data));
    } else {
      const data = await getChatbotLogs(50);
      setLogs(data);
    }
    setLoading(false);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveFaq = async (faqData: Partial<ChatbotFaq>) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertChatbotFaq(faqData);
      if (editingId) {
        setFaqs(faqs.map((f) => (f.id === saved.id ? saved : f)));
        setEditingId(null);
        showSuccess('تم تحديث السؤال بنجاح');
      } else {
        setFaqs([...faqs, saved]);
        setIsAddingMode(false);
        showSuccess('تم إضافة السؤال بنجاح');
      }
      setCategories(getFaqCategories(editingId
        ? faqs.map((f) => (f.id === saved.id ? saved : f))
        : [...faqs, saved]
      ));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteChatbotFaq(id);
      const updated = faqs.filter((f) => f.id !== id);
      setFaqs(updated);
      setCategories(getFaqCategories(updated));
      showSuccess('تم حذف السؤال');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (faq: ChatbotFaq) => {
    try {
      const updated = await upsertChatbotFaq({ ...faq, is_active: !faq.is_active });
      setFaqs(faqs.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const reordered = [...faqs];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    setFaqs(reordered);
    await updateFaqsOrder(reordered);
  };

  const handleMoveDown = async (index: number) => {
    if (index === faqs.length - 1) return;
    const reordered = [...faqs];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    setFaqs(reordered);
    await updateFaqsOrder(reordered);
  };

  // Drag and Drop handlers
  const handleDragStart = (id: string, index: number) => {
    dragIndexRef.current = index;
    setDrag({ draggingId: id, overIndex: index });
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDrag((prev) => ({ ...prev, overIndex: index }));
  };
  const handleDrop = async (dropIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDrag({ draggingId: null, overIndex: null });
      return;
    }
    const reordered = [...faqs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setFaqs(reordered);
    setDrag({ draggingId: null, overIndex: null });
    await updateFaqsOrder(reordered);
    showSuccess('تم إعادة الترتيب');
  };

  // Filtered FAQs
  const filteredFaqs = faqs.filter((faq) => {
    const matchCat = !filterCategory || faq.category === filterCategory;
    const matchSearch = !searchQuery ||
      faq.question.includes(searchQuery) ||
      faq.answer.includes(searchQuery) ||
      (Array.isArray(faq.trigger_keywords) && faq.trigger_keywords.some((kw) => kw.includes(searchQuery)));
    return matchCat && matchSearch;
  });

  // Stats
  const activeCount = faqs.filter((f) => f.is_active).length;
  const unmatchedLogs = logs.filter((l) => l.is_unmatched).length;

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 pb-12" dir="rtl">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
            <a href="/admin" className="hover:text-blue-600 transition-colors">الرئيسية</a>
            <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            <span className="text-slate-900">إدارة المساعد الذكي</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-slate-900">
              إدارة المساعد الذكي
            </h1>
            <AdminInfoTooltip title="إدارة الأسئلة" description="قم بإدارة الأسئلة الشائعة التي يستخدمها البوت للرد على العملاء. كلما كانت الكلمات المفتاحية أكثر دقة، كان الرد أدق." />
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {activeCount} سؤال نشط من أصل {faqs.length} — يرد البوت على استفسارات العملاء تلقائياً
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'faqs' && !isAddingMode && !editingId && (
            <button
              onClick={() => setIsAddingMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-xs font-bold uppercase transition-colors shadow-xs flex-shrink-0"
            >
              <IconPlus />
              <span>إضافة سؤال</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold uppercase text-slate-700 transition-colors shadow-xs"
          >
            <IconRefresh />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-emerald-600 block">
            أسئلة نشطة
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">مفعلة وتعمل حالياً</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            إجمالي الأسئلة
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{faqs.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">نشطة ومخفية</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-600 block">
            استفسارات بلا إجابة
          </span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{unmatchedLogs}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">تتطلب مراجعة أو إضافة</span>
        </div>
      </div>

      {/* ── Alert banners ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
          <IconX />
          {error}
          <button onClick={() => setError(null)} className="mr-auto"><IconX /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-xl">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          {success}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'faqs', label: 'الأسئلة الشائعة', icon: <IconList /> },
          { id: 'logs', label: 'سجل المحادثات', icon: <IconBot /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'faqs' | 'logs')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────
          FAQs Tab
      ──────────────────────────────────────────── */}
      {activeTab === 'faqs' && (
        <div className="space-y-4">
          {/* Add form */}
          {isAddingMode && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase">إضافة سؤال جديد</h3>
              <FaqForm
                categories={categories}
                onSave={handleSaveFaq}
                onCancel={() => setIsAddingMode(false)}
                saving={saving}
              />
            </div>
          )}

          {/* SEARCH & STATUS FILTERS */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
            <div className="flex-1 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <IconSearch />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الأسئلة..."
                className="bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none w-full"
                dir="rtl"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center overflow-x-auto gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  filterCategory === null
                    ? 'bg-white text-black shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                الكل
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat === filterCategory ? null : cat)}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    filterCategory === cat
                      ? 'bg-white text-black shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ List */}
          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
              جاري التحميل...
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-300 rounded-2xl bg-white">
              {searchQuery ? `لا توجد نتائج لـ "${searchQuery}"` : 'لا توجد أسئلة. اضغط "إضافة سؤال" للبدء.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq, index) => {
                const isEditing = editingId === faq.id;
                const isExpanded = expandedId === faq.id;
                const isDraggingOver = drag.overIndex === index && drag.draggingId !== faq.id;
                const isBeingDragged = drag.draggingId === faq.id;

                return (
                  <div
                    key={faq.id}
                    draggable={!isEditing}
                    onDragStart={() => handleDragStart(faq.id, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDrag({ draggingId: null, overIndex: null })}
                    className={`bg-white border rounded-xl shadow-xs transition-all duration-150 ${
                      isDraggingOver ? 'border-blue-400 bg-blue-50' :
                      isBeingDragged ? 'border-slate-300 opacity-50' :
                      'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isEditing ? (
                      <div className="p-6">
                        <p className="text-sm font-bold uppercase text-slate-900 mb-4">تعديل السؤال</p>
                        <FaqForm
                          initial={faq}
                          categories={categories}
                          onSave={handleSaveFaq}
                          onCancel={() => setEditingId(null)}
                          saving={saving}
                        />
                      </div>
                    ) : (
                      <div>
                        {/* Row */}
                        <div className="flex items-center gap-3 px-5 py-4">
                          {/* Drag handle */}
                          <div className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                            <IconGrip />
                          </div>

                          {/* Content */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                            className="flex-1 text-right min-w-0 group"
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{faq.category}</span>
                              {!faq.is_active && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-bold uppercase tracking-wide">مخفي</span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{faq.question}</p>
                            {isExpanded && (
                              <p className="text-xs text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                            )}
                            {isExpanded && Array.isArray(faq.trigger_keywords) && faq.trigger_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                                {faq.trigger_keywords.map((kw) => (
                                  <span key={kw} className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 font-medium rounded-full">{kw}</span>
                                ))}
                              </div>
                            )}
                          </button>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Move up/down */}
                            <div className="flex flex-col gap-0.5 mr-2">
                              <button
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors rounded hover:bg-slate-100"
                                title="تحريك لأعلى"
                              >
                                <IconChevronUp />
                              </button>
                              <button
                                onClick={() => handleMoveDown(index)}
                                disabled={index === faqs.length - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors rounded hover:bg-slate-100"
                                title="تحريك لأسفل"
                              >
                                <IconChevronDown />
                              </button>
                            </div>

                            {/* Toggle active */}
                            <button
                              onClick={() => handleToggleActive(faq)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${faq.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                              title={faq.is_active ? 'إخفاء' : 'تفعيل'}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${faq.is_active ? 'right-0.5' : 'left-0.5'}`} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => { setEditingId(faq.id); setIsAddingMode(false); setExpandedId(null); }}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                              title="تعديل"
                            >
                              <IconEdit />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(faq.id)}
                              disabled={deletingId === faq.id}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-40"
                              title="حذف"
                            >
                              {deletingId === faq.id ? (
                                <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin block" />
                              ) : <IconTrash />}
                            </button>

                            {/* Expand toggle */}
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                              className="p-2 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100 ml-1"
                            >
                              {isExpanded ? <IconChevronUp /> : <IconChevronDown />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────
          Logs Tab
      ──────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
              جاري التحميل...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-300 rounded-2xl bg-white">
              لا توجد محادثات مسجلة بعد.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-start gap-4 shadow-xs">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  log.is_human_handoff ? 'bg-amber-400' :
                  log.is_unmatched ? 'bg-red-400' : 'bg-emerald-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 font-bold truncate" dir="rtl">{log.user_message}</p>
                  {log.chatbot_faqs?.question && (
                    <p className="text-xs text-slate-500 mt-1 font-medium" dir="rtl">
                      تطابق: {log.chatbot_faqs.question}
                    </p>
                  )}
                  {log.is_unmatched && <p className="text-xs font-bold text-red-500 mt-1">لم يُعثر على إجابة</p>}
                  {log.is_human_handoff && <p className="text-xs font-bold text-amber-600 mt-1">طلب تحويل لخدمة العملاء</p>}
                </div>
                <p className="text-[10px] font-bold text-slate-400 flex-shrink-0 uppercase tracking-wider">
                  {log.created_at ? new Date(log.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }) : '—'}
                </p>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
