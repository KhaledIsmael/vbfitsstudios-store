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
import { VariantsEditor } from '../../components/admin/VariantsEditor';
import { RelatedProductsPicker } from '../../components/admin/RelatedProductsPicker';
import {
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Edit3,
  Check,
  X,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  ArrowLeft,
  Save,
  Loader2
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
  const [activeEditorTab, setActiveEditorTab] = useState<'details' | 'variants' | 'media' | 'seo'>('details');
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
      // Status filtering
      if (statusFilter === 'active' && (p.is_archived || !p.is_published)) return false;
      if (statusFilter === 'draft' && (p.is_archived || p.is_published)) return false;
      if (statusFilter === 'archived' && !p.is_archived) return false;

      // Text query searching
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inVariants = p.variants?.some(
        (v) => v.sku.toLowerCase().includes(q) || v.color.toLowerCase().includes(q)
      );
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
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
      subtitle: 'Luxury Archival Silhouette',
      description: '',
      price: 180,
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
      details: ['Handcrafted in limited atelier batches', 'Custom boxy luxury cut'],
      fabric_care: ['100% Organic Heavyweight Cotton', 'Dry clean or gentle cold wash'],
      shipping_info: 'Complimentary express worldwide delivery within 2-4 business days.',
      variants: [
        { size: 'S', color: 'Washed Black', color_hex: '#111111', stock: 10, sku: 'VB-NEW-S' },
        { size: 'M', color: 'Washed Black', color_hex: '#111111', stock: 15, sku: 'VB-NEW-M' },
        { size: 'L', color: 'Washed Black', color_hex: '#111111', stock: 12, sku: 'VB-NEW-L' }
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
    setFormVariants([...prod.variants]);
    setFormImages([...prod.images]);
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
      alert(`Archive action failed: ${res.error}`);
    }
  };

  // Auto generate slug from name if empty
  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug && !prev.slug.startsWith('new-') ? prev.slug : autoSlug,
      seo_title: prev.seo_title || `${name} | VB Fits Studios`
    }));
  };

  // Save product form submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setSaveFeedback({ type: 'error', msg: 'Product Name is required.' });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const { data: saved, error } = await saveAdminProduct(formData, formVariants, formImages);

    if (error || !saved) {
      setSaveFeedback({ type: 'error', msg: error || 'Failed to save silhouette.' });
      setIsSaving(false);
      return;
    }

    setSaveFeedback({ type: 'success', msg: 'Silhouette saved successfully.' });
    setIsSaving(false);

    // Refresh products list
    await loadData();

    // Close drawer after brief visual confirmation
    setTimeout(() => {
      setIsEditorOpen(false);
      setSaveFeedback(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & METRICS                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Silhouettes & Ready-to-Wear
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Catalogue lifecycle management, variant matrix, photography, and soft-delete archiving.
          </p>
        </div>

        {/* Create new product CTA */}
        <button
          type="button"
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 text-xs uppercase tracking-luxury font-medium transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>New Silhouette</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Catalogue', count: stats.total, color: 'text-white' },
          { label: 'Active in Storefront', count: stats.active, color: 'text-emerald-400' },
          { label: 'Draft Silhouettes', count: stats.drafts, color: 'text-amber-400' },
          { label: 'Archived (Soft Deleted)', count: stats.archived, color: 'text-white/40' }
        ].map((item) => (
          <div key={item.label} className="p-4 bg-[#121215] border border-white/10">
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
              {item.label}
            </span>
            <span className={`text-2xl font-light font-mono mt-1 block ${item.color}`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SEARCH & STATUS FILTER TABS                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121215] border border-white/10 p-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { label: 'All Items', value: 'all', count: stats.total },
              { label: 'Active', value: 'active', count: stats.active },
              { label: 'Drafts', value: 'draft', count: stats.drafts },
              { label: 'Archived', value: 'archived', count: stats.archived }
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 bg-[#18181D] border border-white/10 px-3 py-1.5 w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, slug, color, SKU..."
            className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="text-white/40 hover:text-white text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. PRODUCTS CATALOG TABLE                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[9px]">
              <th className="py-3 px-4">Silhouette & Thumbnail</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Variant Matrix & Stock</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-white/40 font-mono">
                  Retrieving catalogue database...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-white/40 font-mono">
                  No silhouettes match the current status filter or query.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const totalStock = p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) ?? 0;
                const primaryImage = p.images?.[0]?.url || '/assets/products/black-shirt.jpeg';

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Item */}
                    <td className="py-3.5 px-4 flex items-center gap-3.5">
                      <div className="w-12 h-14 bg-[#FAFAFA] flex items-center justify-center p-1 rounded-none flex-shrink-0 border border-white/10">
                        <img
                          src={primaryImage}
                          alt={p.name}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-white truncate max-w-[200px] sm:max-w-xs text-sm">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono mt-0.5">
                          <span>/{p.slug}</span>
                          <span>·</span>
                          <span>{p.images?.length || 0} media</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 font-mono text-white/70">
                      {p.category?.name || 'Ready-to-Wear'}
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-mono text-white font-medium">
                      {p.price.toFixed(2)} {p.currency || 'EGP'}
                    </td>

                    {/* Variants & Stock */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-white/80">{p.variants?.length || 0} sizes</span>
                        <span className="text-white/30">|</span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] ${
                            totalStock === 0
                              ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                              : totalStock <= 10
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-500/20'
                              : 'text-white/60'
                          }`}
                        >
                          {totalStock} units total
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {p.is_archived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase bg-white/5 text-white/50 border border-white/10">
                          <Archive className="w-2.5 h-2.5" />
                          Archived
                        </span>
                      ) : p.is_published ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase bg-amber-950/40 text-amber-300 border border-amber-500/30">
                          Draft
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 border border-white/10 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* Archive / Restore Button (Soft delete) */}
                        <button
                          type="button"
                          onClick={() => handleArchiveToggle(p)}
                          title={p.is_archived ? 'Restore silhouette to active' : 'Archive silhouette (soft delete)'}
                          className={`p-1.5 border transition-colors ${
                            p.is_archived
                              ? 'border-white/20 text-white/60 hover:text-white hover:border-white'
                              : 'border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-400/40'
                          }`}
                        >
                          {p.is_archived ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* View in Storefront */}
                        <a
                          href={`/product/${p.slug || p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open product on storefront"
                          className="p-1.5 border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PRODUCT EDITOR SLIDE-OVER DRAWER                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsEditorOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-4xl bg-[#121215] border-l border-white/10 flex flex-col shadow-2xl">
              {/* Drawer Header */}
              <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#151519]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="text-white/60 hover:text-white p-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-white">
                      {editingProduct?.id.startsWith('new-') ? 'New Silhouette' : `Edit: ${formData.name || 'Untitled'}`}
                    </h2>
                    <span className="text-[9px] font-mono text-white/40 uppercase">
                      ID: {formData.id} {formData.is_archived && '· ARCHIVED'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="text-white/40 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-white/10 bg-[#0E0E10] px-6 text-xs font-mono uppercase tracking-wider">
                {[
                  { id: 'details', label: '1. Core Details' },
                  { id: 'variants', label: `2. Variants & Stock (${formVariants.length})` },
                  { id: 'media', label: `3. Photography & Video (${formImages.length})` },
                  { id: 'seo', label: '4. SEO & Merchandising' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveEditorTab(tab.id as any)}
                    className={`py-3 px-4 border-b-2 transition-colors ${
                      activeEditorTab === tab.id
                        ? 'border-white text-white font-medium bg-white/5'
                        : 'border-transparent text-white/50 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Form Content Area */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Feedback banner */}
                {saveFeedback && (
                  <div
                    className={`p-3.5 text-xs font-mono flex items-center gap-2 border ${
                      saveFeedback.type === 'success'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-950/40 text-red-300 border-red-500/30'
                    }`}
                  >
                    {saveFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span>{saveFeedback.msg}</span>
                  </div>
                )}

                {/* ── TAB 1: CORE DETAILS ── */}
                {activeEditorTab === 'details' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Name & Subtitle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                          Silhouette Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g. Long Sleeve Heavyweight Shirt"
                          className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={formData.subtitle || ''}
                          onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                          placeholder="e.g. Autumn / Winter 2026 Edition"
                          className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    {/* Price, Category & Collection Tag */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                          Base Price (EGP) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formData.price ?? ''}
                          onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                          Category
                        </label>
                        <select
                          value={formData.category_id || ''}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                          Collection Tag
                        </label>
                        <select
                          value={formData.collection_tag || 'all'}
                          onChange={(e) => setFormData({ ...formData, collection_tag: e.target.value })}
                          className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                        >
                          <option value="all">All Silhouettes</option>
                          <option value="new">New Arrivals</option>
                          <option value="black">Noir Edition</option>
                          <option value="white">Blanc Edition</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                        Silhouette Narrative & Description
                      </label>
                      <textarea
                        rows={4}
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed editorial garment craftsmanship notes..."
                        className="w-full bg-[#18181D] border border-white/15 p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white leading-relaxed"
                      />
                    </div>

                    {/* Publication & Merchandising Toggles */}
                    <div className="border border-white/10 bg-[#151519] p-4 space-y-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 block">
                        Visibility & Merchandising Flags
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                          <input
                            type="checkbox"
                            checked={formData.is_published !== false}
                            onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                            className="w-4 h-4 accent-white rounded-none cursor-pointer"
                          />
                          <span>Published to Catalog</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                          <input
                            type="checkbox"
                            checked={Boolean(formData.is_new_arrival)}
                            onChange={(e) => setFormData({ ...formData, is_new_arrival: e.target.checked })}
                            className="w-4 h-4 accent-white rounded-none cursor-pointer"
                          />
                          <span>"New Arrival" Tag</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                          <input
                            type="checkbox"
                            checked={Boolean(formData.featured)}
                            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                            className="w-4 h-4 accent-white rounded-none cursor-pointer"
                          />
                          <span>Landing Page Featured</span>
                        </label>
                      </div>
                    </div>

                    {/* Shipping info */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                        Delivery & Returns Text
                      </label>
                      <input
                        type="text"
                        value={formData.shipping_info || ''}
                        onChange={(e) => setFormData({ ...formData, shipping_info: e.target.value })}
                        placeholder="Complimentary delivery within 2-4 days..."
                        className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* ── TAB 2: NESTED VARIANTS EDITOR ── */}
                {activeEditorTab === 'variants' && (
                  <div className="space-y-4 animate-fade-in">
                    <VariantsEditor
                      variants={formVariants}
                      onChange={setFormVariants}
                      productSlug={formData.slug || 'item'}
                      defaultColor={formData.name?.includes('White') ? 'Blanc White' : 'Washed Black'}
                    />
                  </div>
                )}

                {/* ── TAB 3: MEDIA UPLOADER ── */}
                {activeEditorTab === 'media' && (
                  <div className="space-y-4 animate-fade-in">
                    <MediaUploader images={formImages} onChange={setFormImages} />
                  </div>
                )}

                {/* ── TAB 4: SEO & MERCHANDISING ── */}
                {activeEditorTab === 'seo' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Slug */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                        URL Slug Handle (/product/...) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.slug || ''}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="e.g. long-sleeve-washed-black"
                        className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white"
                      />
                    </div>

                    {/* SEO Title */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                        SEO Meta Title (Browser & Search Engine preview)
                      </label>
                      <input
                        type="text"
                        value={formData.seo_title || ''}
                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                        placeholder="Long Sleeve Shirt — VB Fits Studios Archival Ready-to-Wear"
                        className="w-full bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                      />
                    </div>

                    {/* SEO Description */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1.5">
                        SEO Meta Description
                      </label>
                      <textarea
                        rows={3}
                        value={formData.seo_description || ''}
                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                        placeholder="Acquire the Long Sleeve Heavyweight luxury streetwear shirt. Handcrafted in limited batches..."
                        className="w-full bg-[#18181D] border border-white/15 p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white leading-relaxed font-mono"
                      />
                    </div>

                    {/* Related Products Picker */}
                    <div className="pt-4 border-t border-white/10">
                      <RelatedProductsPicker
                        selectedIds={formData.related_product_ids || []}
                        onChange={(ids) => setFormData({ ...formData, related_product_ids: ids })}
                        availableProducts={products}
                        currentProductId={formData.id}
                      />
                    </div>
                  </div>
                )}

                {/* Drawer Footer Actions */}
                <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                  {/* Archive / Restore Button */}
                  {!editingProduct?.id.startsWith('new-') ? (
                    <button
                      type="button"
                      onClick={() => handleArchiveToggle(editingProduct!)}
                      className={`flex items-center gap-1.5 text-xs uppercase font-mono tracking-wider px-3 py-2 border transition-colors ${
                        formData.is_archived
                          ? 'border-white/30 text-white hover:bg-white/10'
                          : 'border-red-500/30 text-red-400 hover:bg-red-950/40'
                      }`}
                    >
                      {formData.is_archived ? (
                        <>
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          <span>Restore Silhouette</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Silhouette (Soft Delete)</span>
                        </>
                      )}
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      className="px-4 py-2.5 text-xs uppercase font-mono tracking-wider text-white/60 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-6 py-2.5 text-xs uppercase tracking-luxury font-medium transition-all disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Silhouette</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
