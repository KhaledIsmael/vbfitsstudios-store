import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminProducts,
  fetchAdminCategories,
  saveAdminProduct,
  archiveAdminProduct,
  type AdminProduct,
  type AdminCategory,
  type AdminProductVariant,
  type AdminProductImage
} from '../../lib/adminProducts';
import { MediaUploader } from '../../components/admin/MediaUploader';
import { AdminInfoTooltip } from '../../components/admin/AdminInfoTooltip';
import { exportProductsToExcel } from '../../lib/adminExport';
import {
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Edit3,
  Check,
  X,
  Package,
  Layers,
  Sparkles,
  Save,
  Loader2,
  Trash2,
  CheckCircle2,
  Eye,
  RefreshCw,
  Tag,
  Download
} from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Editor drawer state
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'details' | 'variants' | 'images'>('details');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<AdminProduct>>({});
  const [formVariants, setFormVariants] = useState<AdminProductVariant[]>([]);
  const [formImages, setFormImages] = useState<AdminProductImage[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        fetchAdminProducts(),
        fetchAdminCategories()
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load products in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Status Filter
      if (statusFilter === 'active' && (p.is_archived || !p.is_published)) return false;
      if (statusFilter === 'draft' && (p.is_archived || p.is_published)) return false;
      if (statusFilter === 'archived' && !p.is_archived) return false;

      // 2. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesCategory = (p.category?.name || '').toLowerCase().includes(q);
        const matchesCollection = (p.collection_tag || '').toLowerCase().includes(q);
        const matchesVariant = (p.variants || []).some(
          (v) => (v.size || '').toLowerCase().includes(q) || (v.sku || '').toLowerCase().includes(q)
        );

        if (!matchesName && !matchesCategory && !matchesCollection && !matchesVariant) {
          return false;
        }
      }

      return true;
    });
  }, [products, statusFilter, searchQuery]);

  // Quick stats
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => !p.is_archived && p.is_published).length;
    const drafts = products.filter((p) => !p.is_archived && !p.is_published).length;
    const archived = products.filter((p) => p.is_archived).length;
    return { total, active, drafts, archived };
  }, [products]);

  // Open editor for brand new product
  const handleCreateNew = () => {
    setEditingProduct({
      id: `new-${Date.now()}`,
      name: '',
      slug: '',
      description: '',
      price: 650,
      currency: 'EGP',
      collection_tag: 'all',
      featured: false,
      is_new_arrival: true,
      is_published: true,
      is_archived: false,
      related_product_ids: [],
      details: [],
      fabric_care: [],
      variants: [
        { size: 'S', stock: 10, sku: 'VB-S', color: 'Black' },
        { size: 'M', stock: 15, sku: 'VB-M', color: 'Black' },
        { size: 'L', stock: 15, sku: 'VB-L', color: 'Black' },
        { size: 'XL', stock: 10, sku: 'VB-XL', color: 'Black' }
      ],
      images: []
    });
    setFormData({
      name: '',
      slug: '',
      subtitle: 'خامة قطن مصري 100% ثقيل',
      description: 'تصميم مميز من براند VB Fits Studios بخامات قطنية مريحة وتقفيل عالي الجودة يناسب الإطلالات اليومية الفاخرة.',
      price: 650,
      currency: 'EGP',
      collection_tag: 'all',
      category_id: categories[0]?.id || '',
      featured: false,
      is_new_arrival: true,
      is_published: true
    });
    setFormVariants([
      { size: 'S', stock: 10, sku: 'VB-S', color: 'Black' },
      { size: 'M', stock: 15, sku: 'VB-M', color: 'Black' },
      { size: 'L', stock: 15, sku: 'VB-L', color: 'Black' },
      { size: 'XL', stock: 10, sku: 'VB-XL', color: 'Black' }
    ]);
    setFormImages([]);
    setActiveEditorTab('details');
    setSaveFeedback(null);
    setIsEditorOpen(true);
  };

  // Open editor to edit an existing product
  const handleEdit = (prod: AdminProduct) => {
    setEditingProduct(prod);
    setFormData({ ...prod });
    setFormVariants(prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : []);
    setFormImages(prod.images ? JSON.parse(JSON.stringify(prod.images)) : []);
    setActiveEditorTab('details');
    setSaveFeedback(null);
    setIsEditorOpen(true);
  };

  // Handle archive toggle
  const handleArchiveToggle = async (prod: AdminProduct) => {
    const actionName = prod.is_archived ? 'استعادة وتفعيل' : 'أرشفة وإخفاء';
    if (!confirm(`هل أنت متأكد من ${actionName} القطعة (${prod.name})؟`)) return;

    const res = await archiveAdminProduct(prod.id, !prod.is_archived);
    if (!res.error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, is_archived: !prod.is_archived } : p))
      );
    } else {
      alert(`عذراً، حدث خطأ: ${res.error}`);
    }
  };

  // Handle variant manipulation
  const handleAddVariant = () => {
    const newSize = prompt('أدخل المقاس الجديد (مثال: XXL أو Free Size):');
    if (!newSize || !newSize.trim()) return;
    const cleanSize = newSize.trim().toUpperCase();
    if (formVariants.some((v) => v.size.toUpperCase() === cleanSize)) {
      alert('هذا المقاس موجود بالفعل.');
      return;
    }
    const cleanSku = `${(formData.name || 'VB').slice(0, 3).toUpperCase()}-${cleanSize}`;
    setFormVariants([...formVariants, { size: cleanSize, stock: 10, sku: cleanSku, color: 'Black' }]);
  };

  const handleRemoveVariant = (index: number) => {
    if (formVariants.length <= 1) {
      alert('يجب الإبقاء على مقاس واحد على الأقل للقطعة.');
      return;
    }
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const handleUpdateVariantStock = (index: number, stock: number) => {
    const updated = [...formVariants];
    updated[index].stock = Math.max(0, stock);
    setFormVariants(updated);
  };

  // Save changes
  const handleSave = async () => {
    if (!formData.name || !formData.name.trim()) {
      setSaveFeedback({ type: 'error', msg: 'يرجى كتابة اسم قطعة الملابس.' });
      return;
    }
    if (!formData.price || formData.price <= 0) {
      setSaveFeedback({ type: 'error', msg: 'يرجى تحديد سعر صالح بالجنيه المصري EGP.' });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const payload: Partial<AdminProduct> = {
      id: editingProduct?.id || `new-${Date.now()}`,
      name: formData.name.trim(),
      slug:
        formData.slug ||
        formData.name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '') ||
        `item-${Date.now()}`,
      subtitle: formData.subtitle || '',
      description: formData.description || '',
      price: Number(formData.price),
      currency: 'EGP',
      category_id: formData.category_id,
      collection_tag: formData.collection_tag || 'all',
      featured: Boolean(formData.featured),
      is_new_arrival: Boolean(formData.is_new_arrival),
      is_published: formData.is_published !== false,
      is_archived: Boolean(formData.is_archived),
      related_product_ids: formData.related_product_ids || [],
      details: formData.details || [],
      fabric_care: formData.fabric_care || [],
      variants: formVariants,
      images: formImages
    };

    const res = await saveAdminProduct(payload, formVariants, formImages);
    setIsSaving(false);

    if (!res.error) {
      setSaveFeedback({ type: 'success', msg: 'تم حفظ القطعة وتحديث المتجر والمخزون بنجاح!' });
      await loadData();
      setTimeout(() => {
        setIsEditorOpen(false);
      }, 1200);
    } else {
      setSaveFeedback({ type: 'error', msg: `تعذر الحفظ: ${res.error || 'خطأ غير معروف'}` });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-slate-800">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              كتالوج الملابس والمخزون
            </h1>
            <AdminInfoTooltip
              title="كتالوج الملابس"
              description="هنا يمكنك إضافة أي قطعة جديدة لبراندك (تيشرتات، هوديز، بناطيل، إكسسوارات)، تحديد الأسعار بالجنيه المصري EGP، وتعديل كميات المقاسات المتوفرة في المخزن."
              tip="تأكد دائماً من كتابة اسم جذاب وصور واضحة للقطعة لجذب الزبائن وزيادة المبيعات."
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            أضف القطع الجديدة، حدد الأسعار والمقاسات بالجنيه المصري، وتابع الكميات المتبقية في المخزن.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportProductsToExcel(filteredProducts)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 text-xs font-bold rounded-lg border border-slate-200 transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" />
            <span>تصدير الكتالوج (Excel)</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-zinc-950 text-white hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>إضافة قطعة ملابس جديدة</span>
          </button>
        </div>
      </div>

      {/* كروت الإحصائيات السريعة للمخزون */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي منتجات البراند', count: stats.total, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'معروض للبيع بالمتجر لايف', count: stats.active, color: 'text-emerald-700', bg: 'bg-emerald-50/60 border-emerald-200' },
          { label: 'مسودات (غير منشورة بعد)', count: stats.drafts, color: 'text-zinc-700', bg: 'bg-zinc-100 border-zinc-200' },
          { label: 'منتجات مؤرشفة (مخفية)', count: stats.archived, color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' }
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl border border-slate-200 shadow-2xs ${item.bg}`}>
            <span className="text-xs font-bold text-slate-500 block">{item.label}</span>
            <span className={`text-2xl font-extrabold font-mono mt-1 block ${item.color}`}>
              {item.count} <span className="text-xs font-sans font-normal text-slate-400">قطعة</span>
            </span>
          </div>
        ))}
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
            placeholder="ابحث باسم الموديل أو القسم أو المقاس..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-10 pl-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
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
            { id: 'all', label: 'كل المنتجات' },
            { id: 'active', label: 'منشور لايف' },
            { id: 'draft', label: 'مسودات' },
            { id: 'archived', label: 'المؤرشف' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as StatusFilter)}
              className={`px-3.5 py-2 rounded-lg whitespace-nowrap text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-zinc-950 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. جدول المنتجات                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">لم يتم العثور على أي قطعة ملابس</p>
            <p className="text-xs text-slate-400 mt-1">اضغط على زر (إضافة قطعة ملابس جديدة) لإضافة أول منتج لمتجرك.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">القطعة</th>
                  <th className="py-3.5 px-4 font-bold">القسم والكولكشن</th>
                  <th className="py-3.5 px-4 font-bold">السعر بالجنيه</th>
                  <th className="py-3.5 px-4 font-bold">المقاسات والمخزون</th>
                  <th className="py-3.5 px-4 font-bold">حالة الظهور</th>
                  <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod) => {
                  const primaryImg = prod.images?.find((img) => img.is_primary)?.url || prod.images?.[0]?.url;
                  const totalStock = (prod.variants || []).reduce((acc, v) => acc + (v.stock || 0), 0);

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {primaryImg ? (
                            <img
                              src={primaryImg}
                              alt={prod.name}
                              className="w-12 h-14 object-cover rounded-lg bg-white border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-12 h-14 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                            {prod.subtitle && (
                              <div className="text-[11px] text-slate-500 font-medium">{prod.subtitle}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">{prod.category?.name || 'ملابس عامة'}</div>
                        <span className="text-[10px] bg-slate-100 text-zinc-700 border border-slate-200 px-1.5 py-0.5 rounded font-mono inline-block mt-0.5 font-bold">
                          {prod.collection_tag || 'all'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 text-sm">
                        {prod.price.toLocaleString()} <span className="text-[10px] font-sans text-zinc-500 font-bold">ج.م</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {prod.variants?.map((v, i) => (
                            <span
                              key={i}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-bold ${
                                v.stock <= 3
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {v.size}: {v.stock}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                          الإجمالي: {totalStock} قطعة متاحة
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {prod.is_archived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 rounded-full">
                            مؤرشف (مخفي)
                          </span>
                        ) : prod.is_published ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            معروض بالمتجر لايف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-full">
                            مسودة غير منشورة
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(prod)}
                            title="تعديل القطعة والمقاسات"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-700" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(prod)}
                            title={prod.is_archived ? 'استعادة وعرض' : 'إخفاء وأرشفة'}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            {prod.is_archived ? (
                              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Archive className="w-3.5 h-3.5 text-rose-500" />
                            )}
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
      {/* 4. شاشة / درج تعديل وإضافة المنتج المبسطة                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            onClick={() => setIsEditorOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          <div
            dir="rtl"
            className="relative w-full max-w-2xl bg-white border-r border-slate-200 h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between shadow-2xl z-10 text-slate-800"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingProduct?.id.startsWith('new-') ? 'إضافة قطعة ملابس جديدة لبراندك' : `تعديل قطعة: ${formData.name}`}
                  </h3>
                  <AdminInfoTooltip
                    title="إضافة وتعديل المنتجات"
                    description="املأ اسم القطعة وسعرها بالجنيه وصورها وكميات المقاسات المتاحة ثم اضغط حفظ لتظهر مباشرة على الموقع."
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 my-4 border-b border-slate-200 pb-2">
                {[
                  { id: 'details', label: '1. البيانات الأساسية والسعر' },
                  { id: 'variants', label: '2. المقاسات والكميات' },
                  { id: 'images', label: '3. صور القطعة' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveEditorTab(t.id as any)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeEditorTab === t.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Feedback Alert */}
              {saveFeedback && (
                <div
                  className={`p-3 rounded-xl mb-4 text-xs font-bold ${
                    saveFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {saveFeedback.msg}
                </div>
              )}

              {/* Tab 1: البيانات الأساسية */}
              {activeEditorTab === 'details' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اسم قطعة الملابس *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: Heavyweight Boxy Tee - Charcoal"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">السعر بالجنيه المصري (EGP) *</label>
                      <input
                        type="number"
                        value={formData.price ?? 650}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-zinc-900 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">القسم</label>
                      <select
                        value={formData.category_id || ''}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white font-medium"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">الكولكشن / التاج (Collection Tag)</label>
                      <select
                        value={formData.collection_tag || 'all'}
                        onChange={(e) => setFormData({ ...formData, collection_tag: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white font-mono font-bold"
                      >
                        <option value="all">جميع الموديلات (All)</option>
                        <option value="new">وصل حديثاً (New Arrivals)</option>
                        <option value="summer">مجموعة الصيف (Summer Drop)</option>
                        <option value="winter">مجموعة الشتاء (Winter Drop)</option>
                        <option value="black">Noir Edition (Black)</option>
                        <option value="white">Blanc Edition (White)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">نبذة قصيرة تحت الاسم</label>
                      <input
                        type="text"
                        value={formData.subtitle || ''}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        placeholder="مثال: قطن مصري 100% ثقيل"
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">وصف وتفاصيل القطعة</label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="اكتب وصفاً جذاباً يشرح مميزات الخامة والقصة وتنسيق اللبس..."
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
                    />
                  </div>

                  {/* تفعيل الظهور بالمتجر */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">نشر القطعة بالمتجر الآن</span>
                      <span className="text-[11px] text-slate-500 block">عند التفعيل تظهر القطعة مباشرة للمشترين</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_published !== false}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 2: المقاسات والكميات المتوفرة */}
              {activeEditorTab === 'variants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">الكميات المتاحة من كل مقاس:</span>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="inline-flex items-center gap-1 text-xs text-zinc-900 hover:text-black font-bold bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مقاس جديد</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formVariants.map((variant, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-extrabold font-mono text-slate-900 text-sm shadow-2xs">
                            {variant.size}
                          </span>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold">كود المقاس (SKU):</span>
                            <span className="font-mono text-slate-800 font-bold text-xs">{variant.sku}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 text-xs font-medium">الكمية بالمخزن:</span>
                            <input
                              type="number"
                              min="0"
                              value={variant.stock}
                              onChange={(e) => handleUpdateVariantStock(idx, Number(e.target.value))}
                              className="w-16 bg-white border border-slate-300 p-1.5 rounded-lg text-center font-mono text-slate-900 font-bold shadow-2xs"
                            />
                            <span className="text-slate-400 text-[10px]">قطع</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50"
                            title="حذف هذا المقاس"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: صور القطعة */}
              {activeEditorTab === 'images' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">صور جلسة التصوير (Lookbook / Catalog):</span>
                    <AdminInfoTooltip
                      title="صور الملابس"
                      description="ارفع صور واضحة عالية الجودة للموديل وهو لابس القطعة عشان تبرز تفاصيل الخامة للزبائن."
                    />
                  </div>

                  <MediaUploader
                    images={formImages}
                    onChange={(updatedImgs) => setFormImages(updatedImgs)}
                  />
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-950 text-white font-bold text-xs rounded-xl hover:bg-zinc-800 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والمزامنة لايف...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-white" />
                    <span>حفظ ونشر على المتجر لايف</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
