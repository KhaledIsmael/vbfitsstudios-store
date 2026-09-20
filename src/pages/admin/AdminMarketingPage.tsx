import React, { useState, useEffect } from 'react';
import {
  fetchDiscountCodes,
  createDiscountCode,
  toggleDiscountCodeActive,
  deleteDiscountCode,
  fetchNewsletterSubscribers,
  exportSubscribersCSV,
  getStorefrontAnnouncement,
  updateStorefrontAnnouncement,
  type DiscountCode,
  type NewsletterSubscriber,
  type StoreAnnouncement
} from '../../lib/adminMarketing';
import {
  Sparkles,
  Tag,
  Mail,
  Plus,
  Download,
  Trash2,
  Check,
  X,
  Search,
  ExternalLink,
  Percent,
  DollarSign,
  AlertCircle,
  Calendar,
  Layers,
  Copy
} from 'lucide-react';

export const AdminMarketingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discounts' | 'newsletter' | 'banner'>('discounts');
  
  // Discounts state
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New Code Form State
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeType, setNewCodeType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCodeValue, setNewCodeValue] = useState(10);
  const [newCodeMinSpend, setNewCodeMinSpend] = useState(0);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<string>('');
  const [newCodeExpiry, setNewCodeExpiry] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Newsletter state
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subSearch, setSubSearch] = useState('');

  // Announcement Banner state
  const [banner, setBanner] = useState<StoreAnnouncement>({
    enabled: true,
    text: 'COMPLIMENTARY EXPRESS DELIVERY ON ALL ORDERS ABOVE $200 · CAIRO & GIZA HUB',
    link: '/shop'
  });
  const [bannerSaved, setBannerSaved] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [codesData, subsData, bannerData] = await Promise.all([
        fetchDiscountCodes(),
        fetchNewsletterSubscribers(),
        getStorefrontAnnouncement()
      ]);
      setCodes(codesData);
      setSubscribers(subsData);
      setBanner(bannerData);
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
      setFormError('Please enter a valid coupon code string.');
      return;
    }

    const { success, data, error } = await createDiscountCode({
      code: newCodeName.trim().toUpperCase(),
      discount_type: newCodeType,
      discount_value: Number(newCodeValue),
      min_spend: Number(newCodeMinSpend) || 0,
      max_uses: newCodeMaxUses ? parseInt(newCodeMaxUses, 10) : null,
      starts_at: new Date().toISOString(),
      expires_at: newCodeExpiry ? new Date(newCodeExpiry).toISOString() : null,
      is_active: true
    });

    if (!success) {
      setFormError(error || 'Failed to create discount code.');
      return;
    }

    if (data) {
      setCodes((prev) => [data, ...prev]);
    }
    setModalOpen(false);
    setNewCodeName('');
    setNewCodeValue(10);
    setNewCodeMinSpend(0);
    setNewCodeMaxUses('');
    setNewCodeExpiry('');
  };

  // Handle Toggle Active
  const handleToggleCode = async (id: string, current: boolean) => {
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c)));
    await toggleDiscountCodeActive(id, !current);
  };

  // Handle Delete Code
  const handleDeleteCode = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate and remove this promo code?')) return;
    setCodes((prev) => prev.filter((c) => c.id !== id));
    await deleteDiscountCode(id);
  };

  // Handle Copy Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Handle Save Announcement Banner
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStorefrontAnnouncement(banner);
    setBannerSaved(true);
    setTimeout(() => setBannerSaved(false), 2500);
  };

  // Filtered Codes
  const filteredCodes = codes.filter((c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Filtered Subscribers
  const filteredSubscribers = subscribers.filter((s) =>
    s.email.toLowerCase().includes(subSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-6 animate-fade-in text-white pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Marketing & Conversions Engine
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Manage dynamic discount codes, newsletter subscriber export, and storefront announcement broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'discounts' && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white text-black text-xs font-medium uppercase tracking-wider hover:bg-white/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Privilege Code</span>
            </button>
          )}

          {activeTab === 'newsletter' && (
            <button
              type="button"
              onClick={() => exportSubscribersCSV(filteredSubscribers)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white text-black text-xs font-medium uppercase tracking-wider hover:bg-white/90 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({filteredSubscribers.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── TAB SELECTOR ── */}
      <div className="flex border-b border-white/10 bg-[#121215] text-xs font-mono uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab('discounts')}
          className={`py-3 px-6 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'discounts'
              ? 'border-white text-white font-semibold bg-white/5'
              : 'border-transparent text-white/50 hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Discount Codes ({codes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('newsletter')}
          className={`py-3 px-6 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'newsletter'
              ? 'border-white text-white font-semibold bg-white/5'
              : 'border-transparent text-white/50 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Newsletter Subscribers ({subscribers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`py-3 px-6 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'banner'
              ? 'border-white text-white font-semibold bg-white/5'
              : 'border-transparent text-white/50 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Storefront Announcement Banner</span>
        </button>
      </div>

      {/* ── TAB 1: DISCOUNT CODES ── */}
      {activeTab === 'discounts' && (
        <div className="space-y-4 animate-fade-in">
          {/* Search toolbar */}
          <div className="flex items-center gap-3 bg-[#121215] border border-white/10 px-3 py-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active privilege codes (e.g. WELCOME10, VIP20)..."
              className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
            />
          </div>

          {/* Table */}
          <div className="border border-white/10 bg-[#121215] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[10px]">
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Benefit</th>
                  <th className="py-3 px-4">Min Spend</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Expiration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-white/40">Loading discount codes...</td></tr>
                ) : filteredCodes.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-white/40 font-sans">No discount codes match query.</td></tr>
                ) : (
                  filteredCodes.map((c) => {
                    const isExpired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="bg-white/10 px-2 py-0.5 border border-white/15 tracking-wider">
                              {c.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(c.code)}
                              className="text-white/40 hover:text-white"
                              title="Copy code"
                            >
                              {copiedCode === c.code ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-emerald-300 font-semibold">
                          {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `$${c.discount_value.toFixed(2)} OFF`}
                        </td>

                        <td className="py-3.5 px-4 text-white/70">
                          {c.min_spend > 0 ? `$${c.min_spend.toFixed(2)}` : 'None'}
                        </td>

                        <td className="py-3.5 px-4 text-white/60">
                          <span>{c.times_used}</span>
                          {c.max_uses ? <span className="text-white/40"> / {c.max_uses}</span> : <span className="text-white/30"> (∞)</span>}
                        </td>

                        <td className="py-3.5 px-4 text-[11px] text-white/50">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Perpetual'}
                        </td>

                        <td className="py-3.5 px-4">
                          {isExpired ? (
                            <span className="px-2 py-0.5 text-[9px] uppercase bg-red-950/40 text-red-400 border border-red-500/30">
                              Expired
                            </span>
                          ) : c.is_active ? (
                            <span className="px-2 py-0.5 text-[9px] uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] uppercase bg-white/5 text-white/40 border border-white/10">
                              Disabled
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleCode(c.id, c.is_active)}
                              className={`text-[10px] uppercase font-mono px-2 py-1 border transition-colors ${
                                c.is_active
                                  ? 'border-white/20 text-white/60 hover:text-white'
                                  : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                              }`}
                            >
                              {c.is_active ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCode(c.id)}
                              className="text-white/30 hover:text-red-400 p-1 transition-colors"
                              title="Delete code"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: NEWSLETTER SUBSCRIBERS ── */}
      {activeTab === 'newsletter' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-[#121215] border border-white/10 px-3 py-2.5">
            <div className="flex items-center gap-2.5 w-full">
              <Search className="w-4 h-4 text-white/40" />
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="Filter by email address..."
                className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
              />
            </div>
            <span className="text-[10px] font-mono uppercase text-white/40 whitespace-nowrap pl-4">
              {filteredSubscribers.length} Leads
            </span>
          </div>

          <div className="border border-white/10 bg-[#121215] overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-[10px]">
                  <th className="py-3 px-4">Subscriber Email</th>
                  <th className="py-3 px-4">Acquisition Channel</th>
                  <th className="py-3 px-4">Opt-In Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSubscribers.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-white/40">No subscribers match query.</td></tr>
                ) : (
                  filteredSubscribers.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-bold text-white">{s.email}</td>
                      <td className="py-3 px-4 text-white/60 uppercase text-[10px]">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10">{s.source}</span>
                      </td>
                      <td className="py-3 px-4 text-white/40 text-[11px]">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-400 text-[10px]">✓ Subscribed</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: STOREFRONT ANNOUNCEMENT BANNER ── */}
      {activeTab === 'banner' && (
        <div className="max-w-2xl bg-[#121215] border border-white/10 p-6 space-y-6 animate-fade-in">
          <div>
            <h2 className="text-sm font-light uppercase tracking-wider text-white">
              Announcement Top Ribbon Settings
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Broadcast urgent delivery deadlines, promotional codes, or atelier notices directly atop every page.
            </p>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 block">
              Storefront Preview
            </span>
            <div className={`p-3 text-center text-xs font-mono uppercase tracking-widest transition-all ${
              banner.enabled ? 'bg-white text-black font-semibold' : 'bg-white/5 text-white/30 border border-dashed border-white/10'
            }`}>
              {banner.enabled ? banner.text : '(Banner is currently disabled)'}
            </div>
          </div>

          <form onSubmit={handleSaveBanner} className="space-y-5">
            {/* Enabled Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#18181D] border border-white/10">
              <div>
                <p className="text-xs font-medium uppercase text-white">Display Ribbon</p>
                <p className="text-[10px] text-white/40 font-mono mt-0.5">Toggle banner visibility live on storefront</p>
              </div>
              <button
                type="button"
                onClick={() => setBanner({ ...banner, enabled: !banner.enabled })}
                className={`w-12 h-6 flex items-center transition-colors p-1 ${
                  banner.enabled ? 'bg-emerald-500 justify-end' : 'bg-white/10 justify-start'
                }`}
              >
                <span className="w-4 h-4 bg-white shadow block" />
              </button>
            </div>

            {/* Banner Text */}
            <div className="space-y-1.5 font-mono">
              <label className="text-[10px] uppercase tracking-widest text-white/50 block">
                Announcement Message
              </label>
              <textarea
                rows={2}
                value={banner.text}
                onChange={(e) => setBanner({ ...banner, text: e.target.value })}
                required
                className="w-full bg-[#18181D] border border-white/15 p-3 text-xs text-white focus:outline-none focus:border-white uppercase"
              />
            </div>

            {/* Banner Link */}
            <div className="space-y-1.5 font-mono">
              <label className="text-[10px] uppercase tracking-widest text-white/50 block">
                Target URL Link (Optional)
              </label>
              <input
                type="text"
                value={banner.link || ''}
                onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                placeholder="/shop or /collections"
                className="w-full bg-[#18181D] border border-white/15 p-3 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {bannerSaved && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Banner updated successfully</span>
                </span>
              )}
              <button
                type="submit"
                className="ml-auto px-6 py-2.5 bg-white text-black text-xs font-medium uppercase tracking-wider hover:bg-white/90 transition-colors shadow"
              >
                Save Ribbon Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CREATE PROMO CODE MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#151519] border border-white/15 p-6 space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm font-light uppercase tracking-wider text-white">
                Issue New Privilege Voucher
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePromo} className="space-y-4 font-mono text-xs">
              {/* Code Name */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-white/50 block">Coupon Code</label>
                <input
                  type="text"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                  placeholder="E.G. ATELIER25"
                  required
                  className="w-full bg-[#101014] border border-white/15 p-2.5 text-white tracking-wider uppercase focus:outline-none focus:border-white"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">Discount Type</label>
                  <select
                    value={newCodeType}
                    onChange={(e) => setNewCodeType(e.target.value as any)}
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none uppercase"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Currency ($)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">
                    {newCodeType === 'percentage' ? 'Percentage Off (%)' : 'Amount Off ($)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={newCodeValue}
                    onChange={(e) => setNewCodeValue(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Min Spend & Max Uses */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">Min Cart Spend ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCodeMinSpend}
                    onChange={(e) => setNewCodeMinSpend(parseFloat(e.target.value) || 0)}
                    placeholder="0 = No limit"
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">Max Redemptions</label>
                  <input
                    type="number"
                    min="1"
                    value={newCodeMaxUses}
                    onChange={(e) => setNewCodeMaxUses(e.target.value)}
                    placeholder="Leave blank for unlimited"
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Expiration Date */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-white/50 block">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={newCodeExpiry}
                  onChange={(e) => setNewCodeExpiry(e.target.value)}
                  className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-white/15 text-white/60 hover:text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-white text-black font-medium uppercase tracking-wider hover:bg-white/90 shadow"
                >
                  Activate Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
