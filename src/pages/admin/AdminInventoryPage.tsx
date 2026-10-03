import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchInventoryVariants,
  updateInventoryStock,
  type InventoryVariantItem,
  type RestockTriggerResult
} from '../../lib/adminInventory';
import {
  Search,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Mail,
  Bell,
  Sparkles,
  Plus,
  Minus,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowUpDown,
  Send,
  X
} from 'lucide-react';

type StockFilter = 'all' | 'oos' | 'low' | 'healthy' | 'waitlist';

export const AdminInventoryPage: React.FC = () => {
  const [variants, setVariants] = useState<InventoryVariantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  // Saving state tracking per variant id
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});

  // Restock Notification modal state
  const [restockModalData, setRestockModalData] = useState<{
    variant: InventoryVariantItem;
    result: RestockTriggerResult;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchInventoryVariants();
    setVariants(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered variant list
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      // Stock filter
      if (stockFilter === 'oos' && v.stock !== 0) return false;
      if (stockFilter === 'low' && (v.stock === 0 || v.stock > v.low_stock_threshold)) return false;
      if (stockFilter === 'healthy' && v.stock <= v.low_stock_threshold) return false;
      if (stockFilter === 'waitlist' && v.waitlist_count === 0) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.product_name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.color.toLowerCase().includes(q) ||
        v.size.toLowerCase().includes(q)
      );
    });
  }, [variants, stockFilter, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const totalSKUs = variants.length;
    const oosCount = variants.filter((v) => v.stock === 0).length;
    const lowCount = variants.filter((v) => v.stock > 0 && v.stock <= v.low_stock_threshold).length;
    const healthyCount = variants.filter((v) => v.stock > v.low_stock_threshold).length;
    const totalUnits = variants.reduce((sum, v) => sum + v.stock, 0);
    const totalWaitlist = variants.reduce((sum, v) => sum + v.waitlist_count, 0);

    return { totalSKUs, oosCount, lowCount, healthyCount, totalUnits, totalWaitlist };
  }, [variants]);

  // ── Inline Stock Update Handler ──────────────────────────────────────────
  const handleStockCommit = async (variant: InventoryVariantItem, targetStock: number) => {
    const validStock = Math.max(0, targetStock);
    if (validStock === variant.stock) return;

    setSavingMap((prev) => ({ ...prev, [variant.id]: true }));

    const { success, restockResult } = await updateInventoryStock(variant, validStock);

    if (success) {
      // Update local state
      setVariants((prev) =>
        prev.map((item) =>
          item.id === variant.id ? { ...item, stock: validStock, waitlist_count: restockResult.restockTriggered ? 0 : item.waitlist_count } : item
        )
      );

      // Trigger restock notification modal if clients were subscribed
      if (restockResult.restockTriggered && restockResult.notifiedCount > 0) {
        setRestockModalData({
          variant,
          result: restockResult
        });
      }

      // Visual checkmark feedback
      setSavedSuccessMap((prev) => ({ ...prev, [variant.id]: true }));
      setTimeout(() => {
        setSavedSuccessMap((prev) => ({ ...prev, [variant.id]: false }));
      }, 1500);
    }

    setSavingMap((prev) => ({ ...prev, [variant.id]: false }));
  };

  // ── Inline Threshold Update Handler ──────────────────────────────────────
  const handleThresholdCommit = async (variant: InventoryVariantItem, targetThreshold: number) => {
    const validThreshold = Math.max(0, targetThreshold);
    if (validThreshold === variant.low_stock_threshold) return;

    setSavingMap((prev) => ({ ...prev, [variant.id]: true }));
    const { success } = await updateInventoryStock(variant, variant.stock, validThreshold);

    if (success) {
      setVariants((prev) =>
        prev.map((item) =>
          item.id === variant.id ? { ...item, low_stock_threshold: validThreshold } : item
        )
      );
    }
    setSavingMap((prev) => ({ ...prev, [variant.id]: false }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HEADER & METRIC SUMMARY                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Inventory & Stock Control
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Real-time variant stock tracking, low stock alerts, and automated "Restock Me" notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-[#18181D] hover:bg-white/10 text-white px-3.5 py-2 text-xs uppercase font-mono tracking-wider border border-white/15 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Stock</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
            Total Variants
          </span>
          <span className="text-2xl font-light font-mono text-white mt-1 block">
            {stats.totalSKUs} SKUs
          </span>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">
            {stats.totalUnits} Units Total
          </span>
        </div>

        {/* OUT OF STOCK ALERT CARD */}
        <div
          onClick={() => setStockFilter(stockFilter === 'oos' ? 'all' : 'oos')}
          className={`p-4 border transition-all cursor-pointer ${
            stats.oosCount > 0
              ? 'bg-red-950/30 border-red-500/40 hover:border-red-400'
              : 'bg-[#121215] border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-red-400 block">
              Out of Stock (0)
            </span>
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="text-2xl font-light font-mono text-red-400 mt-1 block">
            {stats.oosCount}
          </span>
          <span className="text-[10px] font-mono text-red-300/70 mt-1 block">
            Critical reorder needed
          </span>
        </div>

        {/* LOW STOCK CARD */}
        <div
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`p-4 border transition-all cursor-pointer ${
            stats.lowCount > 0
              ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
              : 'bg-[#121215] border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-300 block">
              Low Stock (≤ Threshold)
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <span className="text-2xl font-light font-mono text-white mt-1 block">
            {stats.lowCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
            Under minimum buffer
          </span>
        </div>

        {/* HEALTHY STOCK CARD */}
        <div
          onClick={() => setStockFilter(stockFilter === 'healthy' ? 'all' : 'healthy')}
          className="p-4 bg-[#121215] border border-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 block">
              Adequate Stock
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-2xl font-light font-mono text-emerald-300 mt-1 block">
            {stats.healthyCount}
          </span>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">
            Above low threshold
          </span>
        </div>

        {/* PENDING WAITLIST CARD */}
        <div
          onClick={() => setStockFilter(stockFilter === 'waitlist' ? 'all' : 'waitlist')}
          className={`p-4 border transition-all cursor-pointer ${
            stats.totalWaitlist > 0
              ? 'bg-sky-950/30 border-sky-500/40 hover:border-sky-400'
              : 'bg-[#121215] border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-sky-400 block">
              Restock Me Waitlist
            </span>
            <Bell className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <span className="text-2xl font-light font-mono text-sky-300 mt-1 block">
            {stats.totalWaitlist} Clients
          </span>
          <span className="text-[10px] font-mono text-sky-300/70 mt-1 block">
            Subscribed for notifications
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. FILTERS & SEARCH CONTROLS                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121215] border border-white/10 p-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { label: 'All SKUs', value: 'all', count: stats.totalSKUs },
              { label: 'Out of Stock', value: 'oos', count: stats.oosCount },
              { label: 'Low Stock', value: 'low', count: stats.lowCount },
              { label: 'Healthy', value: 'healthy', count: stats.healthyCount },
              { label: 'Has Waitlist', value: 'waitlist', count: stats.totalWaitlist }
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStockFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                stockFilter === tab.value
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#18181D] border border-white/10 px-3 py-1.5 w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by SKU, name, color, size..."
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
      {/* 3. INVENTORY MATRIX TABLE                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[9px]">
              <th className="py-3 px-4">Silhouette</th>
              <th className="py-3 px-4">Colorway</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">SKU Identifier</th>
              <th className="py-3 px-4 min-w-[200px]">Stock (Quick-Edit)</th>
              <th className="py-3 px-4">Low Threshold</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Restock Waitlist</th>
              <th className="py-3 px-4 text-right">Quick Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-white/40 font-mono">
                  Loading inventory matrix...
                </td>
              </tr>
            ) : filteredVariants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-white/40 font-mono">
                  No variants match the current stock filter or search query.
                </td>
              </tr>
            ) : (
              filteredVariants.map((v) => {
                const isOos = v.stock === 0;
                const isLow = v.stock > 0 && v.stock <= v.low_stock_threshold;
                const isSaving = savingMap[v.id];
                const isSuccess = savedSuccessMap[v.id];

                return (
                  <tr
                    key={v.id}
                    className={`transition-colors border-l-4 ${
                      isOos
                        ? 'bg-red-950/20 border-l-red-500 hover:bg-red-950/30'
                        : isLow
                        ? 'bg-amber-950/20 border-l-amber-500 hover:bg-amber-950/30'
                        : 'border-l-transparent hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Silhouette */}
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <img
                        src={v.product_image}
                        alt={v.product_name}
                        className="w-9 h-11 object-contain bg-[#FAFAFA] p-0.5 rounded-none flex-shrink-0 border border-white/10"
                      />
                      <div>
                        <p className="font-medium text-white truncate max-w-[170px] sm:max-w-[220px]">
                          {v.product_name}
                        </p>
                        <a
                          href={`/product/${v.product_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-white/40 hover:text-white flex items-center gap-1"
                        >
                          <span>/{v.product_slug}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </td>

                    {/* Colorway */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                          style={{ backgroundColor: v.color_hex || '#111111' }}
                        />
                        <span className="text-white/80">{v.color}</span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="px-2 py-0.5 bg-white/10 border border-white/15 text-white font-bold text-[11px]">
                        {v.size}
                      </span>
                    </td>

                    {/* SKU */}
                    <td className="py-3.5 px-4 font-mono text-white/70 text-[11px]">
                      {v.sku}
                    </td>

                    {/* Current Stock with INLINE QUICK-EDIT */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStockCommit(v, v.stock - 1)}
                          disabled={v.stock <= 0 || isSaving}
                          className="w-7 h-7 bg-[#18181D] hover:bg-white/10 disabled:opacity-30 text-white flex items-center justify-center border border-white/15 text-xs transition-colors"
                          title="Decrement stock by 1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setVariants((prev) =>
                                prev.map((item) =>
                                  item.id === v.id ? { ...item, stock: val } : item
                                )
                              );
                            }
                          }}
                          onBlur={(e) => handleStockCommit(v, parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleStockCommit(v, parseInt((e.target as HTMLInputElement).value) || 0);
                            }
                          }}
                          className={`w-16 h-7 text-center font-mono text-xs font-semibold px-1 border transition-colors focus:outline-none focus:ring-1 focus:ring-white ${
                            isOos
                              ? 'bg-red-950/60 border-red-500 text-red-200'
                              : isLow
                              ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                              : 'bg-[#18181D] border-white/20 text-white'
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => handleStockCommit(v, v.stock + 1)}
                          disabled={isSaving}
                          className="w-7 h-7 bg-[#18181D] hover:bg-white/10 text-white flex items-center justify-center border border-white/15 text-xs transition-colors"
                          title="Increment stock by 1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Save feedback check */}
                        {isSuccess && (
                          <span className="text-emerald-400 font-mono text-xs flex items-center animate-fade-in pl-1">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Low Stock Threshold (Default 5, editable) */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={v.low_stock_threshold}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setVariants((prev) =>
                                prev.map((item) =>
                                  item.id === v.id ? { ...item, low_stock_threshold: val } : item
                                )
                              );
                            }
                          }}
                          onBlur={(e) => handleThresholdCommit(v, parseInt(e.target.value) || 5)}
                          className="w-12 h-6 text-center font-mono text-xs bg-[#18181D] border border-white/15 text-white/70 focus:outline-none focus:border-white"
                          title="Alert threshold when stock drops to or below this level"
                        />
                        <span className="text-[10px] text-white/40">units</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 font-mono">
                      {isOos ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-red-950/50 text-red-300 border border-red-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          Low Stock ({v.stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase bg-emerald-950/30 text-emerald-300 border border-emerald-500/20">
                          In Stock ({v.stock})
                        </span>
                      )}
                    </td>

                    {/* Restock Waitlist Count */}
                    <td className="py-3.5 px-4 font-mono">
                      {v.waitlist_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-sky-950/40 text-sky-300 border border-sky-500/30">
                          <Bell className="w-3 h-3 text-sky-400" />
                          <span>{v.waitlist_count} Waiting</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/30">—</span>
                      )}
                    </td>

                    {/* Quick Restock Action Pills (+5, +10) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono">
                        <button
                          type="button"
                          onClick={() => handleStockCommit(v, v.stock + 5)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-white/5 hover:bg-white/15 text-[10px] text-white/80 hover:text-white border border-white/15 transition-colors"
                          title="Instantly add 5 units to stock"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStockCommit(v, v.stock + 10)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white font-semibold border border-white/20 transition-colors"
                          title="Instantly add 10 units to stock"
                        >
                          +10
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. AUTOMATED RESTOCK NOTIFICATION MODAL                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {restockModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#151519] border border-white/20 max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setRestockModalData(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 block">
                  Automated Trigger Active
                </span>
                <h3 className="text-base font-light uppercase tracking-wider text-white">
                  Restock Notifications Dispatched
                </h3>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Variant <strong className="text-white">{restockModalData.variant.sku}</strong> (
              {restockModalData.variant.product_name} · Size {restockModalData.variant.size}) just transitioned from{' '}
              <span className="text-red-400 font-mono">0</span> to{' '}
              <span className="text-emerald-400 font-mono">{restockModalData.variant.stock} units</span>.
            </p>

            <div className="my-5 p-4 bg-[#101014] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/60">
                <span>Subscribers Notified:</span>
                <span className="text-emerald-400 font-bold">
                  {restockModalData.result.notifiedCount} Client(s)
                </span>
              </div>
              <div className="divide-y divide-white/5 max-h-32 overflow-y-auto pt-2">
                {restockModalData.result.emails.map((email, idx) => (
                  <div key={idx} className="py-1 text-[11px] font-mono text-white/80 flex items-center gap-2">
                    <Mail className="w-3 h-3 text-white/40" />
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-mono text-white/40 mb-6">
              Subject: "The Wait is Over — Your Size is Back in Stock at VB Fits Studios"
            </p>

            <button
              type="button"
              onClick={() => setRestockModalData(null)}
              className="w-full bg-white text-black hover:bg-white/90 py-2.5 text-xs uppercase font-mono tracking-wider font-semibold transition-colors"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
