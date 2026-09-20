import React, { useState, useEffect } from 'react';
import {
  fetchAdminShippingZones,
  updateAdminShippingZone,
  type AdminShippingZone
} from '../../lib/adminShipping';
import {
  Truck,
  Search,
  Check,
  X,
  RefreshCw,
  Clock,
  DollarSign,
  MapPin,
  ShieldCheck,
  Edit2
} from 'lucide-react';

export const AdminShippingPage: React.FC = () => {
  const [zones, setZones] = useState<AdminShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [codFilter, setCodFilter] = useState<'all' | 'cod_enabled' | 'cod_disabled'>('all');

  // Editing modal / drawer
  const [editingZone, setEditingZone] = useState<AdminShippingZone | null>(null);
  const [editRate, setEditRate] = useState(15);
  const [editMinDays, setEditMinDays] = useState(2);
  const [editMaxDays, setEditMaxDays] = useState(4);
  const [editCod, setEditCod] = useState(true);
  const [saving, setSaving] = useState(false);

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
  };

  const handleQuickToggleCod = async (zone: AdminShippingZone) => {
    const nextVal = !zone.cod_available;
    setZones((prev) =>
      prev.map((z) => (z.governorate === zone.governorate ? { ...z, cod_available: nextVal } : z))
    );
    await updateAdminShippingZone(zone.governorate, { cod_available: nextVal });
  };

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    const matchesCod =
      codFilter === 'all' ||
      (codFilter === 'cod_enabled' && z.cod_available) ||
      (codFilter === 'cod_disabled' && !z.cod_available);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      z.governorate.toLowerCase().includes(q) ||
      (z.governorate_ar && z.governorate_ar.includes(q));

    return matchesCod && matchesSearch;
  });

  // Metrics
  const totalGovernorates = zones.length;
  const codAvailableCount = zones.filter((z) => z.cod_available).length;
  const expressZonesCount = zones.filter((z) => z.min_days <= 2).length;
  const avgRate = zones.length > 0 ? zones.reduce((s, z) => s + z.shipping_rate, 0) / zones.length : 15;

  return (
    <div className="space-y-6 animate-fade-in text-white pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Egyptian Shipping Zones & Logistics Rates
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Configure delivery SLAs, shipping fees, and Cash-on-Delivery (COD) availability across all 27 governorates.
          </p>
        </div>

        <button
          type="button"
          onClick={loadZones}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-[#151519] border border-white/15 hover:border-white/30 text-xs font-mono uppercase text-white/80 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Zones</span>
        </button>
      </div>

      {/* ── METRICS RIBBON ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
            Covered Governorates
          </span>
          <p className="text-2xl font-light font-mono text-white mt-1">{totalGovernorates}</p>
          <span className="text-[10px] font-mono text-emerald-400 mt-1 block">Full Egypt Coverage</span>
        </div>

        <div className="p-4 bg-[#121215] border border-sky-500/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 block">
            Express Hubs (2-4 Days)
          </span>
          <p className="text-2xl font-light font-mono text-sky-300 mt-1">{expressZonesCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Cairo, Giza, Qalyubia</span>
        </div>

        <div className="p-4 bg-[#121215] border border-emerald-500/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block">
            COD Enabled Zones
          </span>
          <p className="text-2xl font-light font-mono text-emerald-300 mt-1">{codAvailableCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Cash on delivery eligible</span>
        </div>

        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
            Average Shipping Fee
          </span>
          <p className="text-2xl font-light font-mono text-white mt-1">${avgRate.toFixed(2)}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Standard courier tier</span>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#121215] p-3 border border-white/10">
        <div className="flex-1 flex items-center gap-2.5 bg-[#18181D] border border-white/10 px-3 py-2">
          <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search governorates in English or Arabic (e.g. Cairo / القاهرة, Alexandria / الإسكندرية)..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
          />
        </div>

        {/* COD Filter */}
        <div className="flex items-center overflow-x-auto gap-1 bg-[#18181D] p-1 border border-white/10 font-mono text-xs uppercase">
          {[
            { id: 'all', label: 'All Regions' },
            { id: 'cod_enabled', label: 'COD Enabled' },
            { id: 'cod_disabled', label: 'COD Restricted' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCodFilter(tab.id as any)}
              className={`px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors ${
                codFilter === tab.id
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GOVERNORATES TABLE ── */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-[10px]">
              <th className="py-3 px-4">Governorate (EN / AR)</th>
              <th className="py-3 px-4">Delivery Window (SLA)</th>
              <th className="py-3 px-4">Shipping Tariff ($)</th>
              <th className="py-3 px-4">Cash On Delivery (COD)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-white/40">Querying shipping matrix...</td></tr>
            ) : filteredZones.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-white/40 font-sans">No governorates match criteria.</td></tr>
            ) : (
              filteredZones.map((z) => (
                <tr key={z.governorate} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-white text-sm">{z.governorate}</span>
                    {z.governorate_ar && (
                      <span className="text-white/40 text-xs ml-2 font-arabic">({z.governorate_ar})</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-white/80">
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10">
                      {z.min_days} – {z.max_days} Business Days
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-white">
                    ${z.shipping_rate.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleQuickToggleCod(z)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] uppercase border transition-colors ${
                        z.cod_available
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/30'
                          : 'bg-red-950/40 text-red-400 border-red-500/30 hover:bg-red-900/30'
                      }`}
                    >
                      {z.cod_available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>{z.cod_available ? 'Available' : 'Disabled'}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(z)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#18181D] hover:bg-white/10 text-white/80 hover:text-white border border-white/15 transition-colors uppercase text-[10px]"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Tariff</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── EDIT MODAL ── */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#151519] border border-white/15 p-6 space-y-5 shadow-2xl text-white font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-light uppercase tracking-wider text-white">
                  Configure Zone — {editingZone.governorate}
                </h3>
                {editingZone.governorate_ar && (
                  <p className="text-[10px] text-white/40 mt-0.5">{editingZone.governorate_ar}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Shipping Rate */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-white/50 block">Shipping Tariff Fee ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editRate}
                  onChange={(e) => setEditRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none focus:border-white"
                />
              </div>

              {/* Min & Max Days */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">Min Days</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={editMinDays}
                    onChange={(e) => setEditMinDays(parseInt(e.target.value, 10) || 1)}
                    required
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-white/50 block">Max Days</label>
                  <input
                    type="number"
                    min="1"
                    max="21"
                    value={editMaxDays}
                    onChange={(e) => setEditMaxDays(parseInt(e.target.value, 10) || 1)}
                    required
                    className="w-full bg-[#101014] border border-white/15 p-2.5 text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* COD Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#101014] border border-white/10">
                <div>
                  <p className="text-white font-medium uppercase text-[11px]">Cash on Delivery (COD)</p>
                  <p className="text-[9px] text-white/40">Enable courier cash collection at doorstep</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCod(!editCod)}
                  className={`w-10 h-5 flex items-center transition-colors p-0.5 ${
                    editCod ? 'bg-emerald-500 justify-end' : 'bg-white/10 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white shadow block" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-4 py-2 border border-white/15 text-white/60 hover:text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-white text-black font-medium uppercase tracking-wider hover:bg-white/90 transition-colors shadow"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
