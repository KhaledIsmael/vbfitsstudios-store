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
  Tag
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
    const [prods, cats] = await Promise.all([
      fetchAdminProducts(),
      fetchAdminCategories()
    ]);
    setProducts(prods);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered list based on search and status
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === 'active' && (p.is_archived || !p.is_published)) return false;
      if (statusFilter === 'draft' && (p.is_archived || p.is_published)) return false;
      if (statusFilter === 'archived' && !p.is_archived) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inVariants = p.variants?.some(
        (v) => v.sku?.toLowerCase().includes(q) || v.size?.toLowerCase().includes(q)
      );
      return (
        p.name.toLowerCase().includes(q) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
        inVariants
      );
    });
  }, [products, statusFilter, searchQuery]);

  // Status counts
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => !p.is_archived && p.is_published).length;
    const drafts = products.filter((p) => !p.is_archived && !p.is_published).length;
    const archived = products.filter((p) => p.is_archived).length;
    return { total, active, drafts, archived };
  }, [products]);

  // Open Editor in "Create New" mode
  const handleCreateNew = () => {
    const newId = `new-${Date.now()}`;
    const newProd: AdminProduct = {
      id: newId,
      name: '',
      slug: '',
      subtitle: 'خامة قطن فاخرة 100% ثقيلة',
      description: 'قطعة مميزة مصممة ومصنعة بعناية فائقة بأحدث قصات الـ Oversized لتناسب الإطلالات اليومية والراقية.',
      price: 650,
      currency: 'EGP',
      category_id: categories[0]?.id || 'cat-shirts',
      collection_tag: 'all',
      featured: false,
      is_new_arrival: true,
      is_published: true,
      is_archived: false,
      seo_title: '',
      seo_description: '',
      related_product_ids: [],
      details: ['قطن مصري 100% قطيفة ناعمة ومعالجة ضد الانكماش', 'قصة Oversized عصرية ومريحة جداً'],
      fabric_care: ['غسيل بماء بارد ومقلوب لحماية الألوان', 'الكي على درجة حرارة متوسطة'],
      shipping_info: 'شحن سريع لجميع محافظات مصر خلال 2-4 أيام عمل.',
      variants: [
        { size: 'S', color: 'أسود', color_hex: '#111111', stock: 15, sku: `VB-S-${Date.now().toString().slice(-4)}` },
        { size: 'M', color: 'أسود', color_hex: '#111111', stock: 25, sku: `VB-M-${Date.now().toString().slice(-4)}` },
        { size: 'L', color: 'أسود', color_hex: '#111111', stock: 20, sku: `VB-L-${Date.now().toString().slice(-4)}` },
        { size: 'XL', color: 'أسود', color_hex: '#111111', stock: 10, sku: `VB-XL-${Date.now().toString().slice(-4)}` }
      ],
      images: []
    };

    setEditingProduct(newProd);
    setFormData(newProd);
    setFormVariants(newProd.variants);
    setFormImages([]);
    setActiveEditorTab('details');
    setSaveFeedback(null);
    setIsEditorOpen(true);
  };

  // Open Editor for an existing product
  const handleEdit = (prod: AdminProduct) => {
    setEditingProduct(prod);
    setFormData({ ...prod });
    setFormVariants(prod.variants ? [...prod.variants] : []);
    setFormImages(prod.images ? [...prod.images] : []);
    setActiveEditorTab('details');
    setSaveFeedback(null);
    setIsEditorOpen(true);
  };

  // Soft Delete toggle (Archive / Restore)
  const handleArchiveToggle = async (prod: AdminProduct) => {
    const nextArchived = !prod.is_archived;
    const res = await archiveAdminProduct(prod.id, nextArchived);
    if (!res.error) {
      setProducts((prev) =>
        prev.map((item) => (item.id === prod.id ? { ...item, is_archived: nextArchived } : item))
      );
      if (editingProduct && editingProduct.id === prod.id) {
        setEditingProduct((prev) => (prev ? { ...prev, is_archived: nextArchived } : null));
        setFormData((prev) => ({ ...prev, is_archived: nextArchived }));
      }
    } else {
      alert(`حدث خطأ أثناء تعديل حالة الأرشفة: ${res.error}`);
    }
  };

  // Variant stock changer
  const handleUpdateVariantStock = (index: number, newStock: number) => {
    setFormVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, stock: Math.max(0, newStock) } : v))
    );
  };

  // Add new size variant
  const handleAddVariant = () => {
    const newSize = prompt('أدخل المقاس الجديد (مثال: XXL أو Free Size):');
    if (!newSize?.trim()) return;
    setFormVariants((prev) => [
      ...prev,
      {
        size: newSize.trim().toUpperCase(),
        color: 'أساسي',
        color_hex: '#111111',
        stock: 10,
        sku: `VB-${newSize.trim().toUpperCase()}-${Date.now().toString().slice(-3)}`
      }
    ]);
  };

  // Remove size variant
  const handleRemoveVariant = (index: number) => {
    setFormVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // Save product form submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setSaveFeedback({ type: 'error', msg: 'يرجى إدخال اسم قطعة الملابس أولاً.' });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const { data: saved, error } = await saveAdminProduct(formData, formVariants, formImages);

    if (error || !saved) {
      setSaveFeedback({ type: 'error', msg: error || 'حدث خطأ أثناء حفظ المنتج، يرجى المحاولة مرة أخرى.' });
      setIsSaving(false);
      return;
    }

    setSaveFeedback({ type: 'success', msg: 'تم حفظ وتحديث قطعة الملابس بنجاح على المتجر!' });
    setIsSaving(false);

    // Refresh products list
    await loadData();

    // Close drawer after brief visual confirmation
    setTimeout(() => {
      setIsEditorOpen(false);
      setSaveFeedback(null);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none text-white">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. رأس الصفحة والملخص                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              كتالوج الملابس والمخزون
            </h1>
            <AdminInfoTooltip
              title="كتالوج الملابس"
              description="هنا يمكنك إضافة أي قطعة جديدة لبراندك (تيشرتات، هوديز، بناطيل، إكسسوارات)، تحديد الأسعار بالجنيه المصري EGP، وتعديل كميات المقاسات المتوفرة في المخزن."
              tip="تأكد دائماً من كتابة اسم جذاب وصور واضحة للقطعة لجذب الزبائن وزيادة المبيعات."
            />
          </div>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            أضف القطع الجديدة، حدد الأسعار والمقاسات بالجنيه المصري، وتابع الكميات المتبقية في المخزن.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 text-xs font-bold rounded-sm transition-all shadow-md self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>إضافة قطعة ملابس جديدة</span>
        </button>
      </div>

      {/* كروت الإحصائيات السريعة للمخزون */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي منتجات البراند', count: stats.total, color: 'text-white' },
          { label: 'معروض للبيع بالمتجر لايف', count: stats.active, color: 'text-emerald-400' },
          { label: 'مسودات (غير منشورة بعد)', count: stats.drafts, color: 'text-amber-400' },
          { label: 'منتجات مؤرشفة (مخفية)', count: stats.archived, color: 'text-white/40' }
        ].map((item, idx) => (
          <div key={idx} className="p-4 bg-[#141418] border border-white/10 rounded-sm">
            <span className="text-xs font-medium text-white/60 block">{item.label}</span>
            <span className={`text-2xl font-bold font-mono mt-1 block ${item.color}`}>
              {item.count} <span className="text-xs font-sans font-normal text-white/40">قطعة</span>
            </span>
          </div>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. شريط البحث والفلترة                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#141418] p-3 sm:p-4 border border-white/10 rounded-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الموديل أو القسم أو المقاس..."
            className="w-full bg-[#18181E] border border-white/10 rounded-sm pr-10 pl-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
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
              className={`px-3 py-1.5 rounded-sm whitespace-nowrap text-xs font-medium transition-colors ${
                statusFilter === tab.id
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
      {/* 3. جدول المنتجات                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#141418] border border-white/10 rounded-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-white/50">
            <Package className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-sm font-semibold text-white/80">لم يتم العثور على أي قطعة ملابس</p>
            <p className="text-xs text-white/40 mt-1">اضغط على زر (إضافة قطعة ملابس جديدة) لإضافة أول منتج لمتجرك.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-white/5 text-white/60 font-mono text-[11px] uppercase border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">القطعة</th>
                  <th className="py-3.5 px-4 font-semibold">القسم والكولكشن</th>
                  <th className="py-3.5 px-4 font-semibold">السعر بالجنيه</th>
                  <th className="py-3.5 px-4 font-semibold">المقاسات والمخزون</th>
                  <th className="py-3.5 px-4 font-semibold">حالة الظهور</th>
                  <th className="py-3.5 px-4 font-semibold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProducts.map((prod) => {
                  const primaryImg = prod.images?.find((img) => img.is_primary)?.url || prod.images?.[0]?.url;
                  const totalStock = (prod.variants || []).reduce((acc, v) => acc + (v.stock || 0), 0);

                  return (
                    <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {primaryImg ? (
                            <img
                              src={primaryImg}
                              alt={prod.name}
                              className="w-12 h-14 object-cover rounded bg-white/5 border border-white/10"
                            />
                          ) : (
                            <div className="w-12 h-14 bg-white/5 border border-white/10 rounded flex items-center justify-center text-white/30">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-sm">{prod.name}</div>
                            {prod.subtitle && (
                              <div className="text-[11px] text-white/50">{prod.subtitle}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white/70">
                        <div>{prod.category?.name || 'ملابس عامة'}</div>
                        <span className="text-[10px] bg-white/5 text-amber-300 px-1.5 py-0.5 rounded font-mono inline-block mt-0.5">
                          {prod.collection_tag || 'all'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                        {prod.price.toLocaleString()} <span className="text-[10px] font-sans text-amber-400">ج.م</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {prod.variants?.map((v, i) => (
                            <span
                              key={i}
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                v.stock <= 3
                                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                  : 'bg-white/5 text-white/70 border-white/10'
                              }`}
                            >
                              {v.size}: {v.stock}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-white/40 mt-1">
                          الإجمالي: {totalStock} قطعة متاحة
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {prod.is_archived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-white/5 text-white/50 border border-white/10 rounded">
                            مؤرشف (مخفي)
                          </span>
                        ) : prod.is_published ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            معروض بالمتجر لايف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-500/30 rounded">
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
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(prod)}
                            title={prod.is_archived ? 'استعادة وعرض' : 'إخفاء وأرشفة'}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors"
                          >
                            {prod.is_archived ? (
                              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Archive className="w-3.5 h-3.5 text-red-400" />
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
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          <div
            dir="rtl"
            className="relative w-full max-w-2xl bg-[#121216] border-r border-white/10 h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between shadow-2xl z-10"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
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
                  className="text-white/60 hover:text-white p-1 rounded hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 my-4 border-b border-white/10 pb-2">
                {[
                  { id: 'details', label: '1. البيانات الأساسية والسعر' },
                  { id: 'variants', label: '2. المقاسات والكميات' },
                  { id: 'images', label: '3. صور القطعة' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveEditorTab(t.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                      activeEditorTab === t.id
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Feedback Alert */}
              {saveFeedback && (
                <div
                  className={`p-3 rounded mb-4 text-xs font-semibold ${
                    saveFeedback.type === 'success'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-950/60 text-red-300 border border-red-500/30'
                  }`}
                >
                  {saveFeedback.msg}
                </div>
              )}

              {/* Tab 1: البيانات الأساسية */}
              {activeEditorTab === 'details' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-white/70 font-semibold mb-1">اسم قطعة الملابس *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: Heavyweight Boxy Tee - Charcoal"
                      className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/70 font-semibold mb-1">السعر بالجنيه المصري (EGP) *</label>
                      <input
                        type="number"
                        value={formData.price ?? 650}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-white/70 font-semibold mb-1">القسم</label>
                      <select
                        value={formData.category_id || ''}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400"
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
                      <label className="block text-white/70 font-semibold mb-1">الكولكشن / التاج (Collection Tag)</label>
                      <select
                        value={formData.collection_tag || 'all'}
                        onChange={(e) => setFormData({ ...formData, collection_tag: e.target.value })}
                        className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
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
                      <label className="block text-white/70 font-semibold mb-1">نبذة قصيرة تحت الاسم</label>
                      <input
                        type="text"
                        value={formData.subtitle || ''}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        placeholder="مثال: قطن مصري 100% ثقيل"
                        className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/70 font-semibold mb-1">وصف وتفاصيل القطعة</label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="اكتب وصفاً جذاباً يشرح مميزات الخامة والقصة وتنسيق اللبس..."
                      className="w-full bg-[#18181E] border border-white/15 p-2.5 rounded text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* تفعيل الظهور بالمتجر */}
                  <div className="p-3 bg-[#18181E] border border-white/10 rounded flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">نشر القطعة بالمتجر الآن</span>
                      <span className="text-[11px] text-white/50 block">عند التفعيل تظهر القطعة مباشرة للمشترين</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_published !== false}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 2: المقاسات والكميات المتوفرة */}
              {activeEditorTab === 'variants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">الكميات المتاحة من كل مقاس:</span>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مقاس جديد</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formVariants.map((variant, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#18181E] border border-white/10 rounded flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-8 rounded bg-white/10 flex items-center justify-center font-bold font-mono text-white text-sm">
                            {variant.size}
                          </span>
                          <div>
                            <span className="text-white/60 block text-[10px]">كود المقاس (SKU):</span>
                            <span className="font-mono text-white text-xs">{variant.sku}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/60 text-xs">الكمية بالمخزن:</span>
                            <input
                              type="number"
                              min="0"
                              value={variant.stock}
                              onChange={(e) => handleUpdateVariantStock(idx, Number(e.target.value))}
                              className="w-16 bg-[#121216] border border-white/20 p-1.5 rounded text-center font-mono text-white font-bold"
                            />
                            <span className="text-white/50 text-[10px]">قطع</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="text-white/40 hover:text-red-400 p-1"
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
                    <span className="text-xs font-bold text-white">صور جلسة التصوير (Lookbook / Catalog):</span>
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
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-black font-bold text-xs rounded hover:bg-white/90 transition-all shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والمزامنة لايف...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-black" />
                    <span>حفظ ونشر على المتجر لايف</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded border border-white/10 transition-colors"
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
