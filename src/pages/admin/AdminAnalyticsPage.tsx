import React, { useState, useEffect } from 'react';
import {
  fetchAnalyticsData,
  type AnalyticsTimeRange,
  type AnalyticsSummaryKPIs,
  type RevenueDataPoint,
  type BestSellingSilhouette,
  type RegionalDistribution
} from '../../lib/adminAnalytics';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  RotateCcw,
  Package,
  MapPin,
  Calendar,
  Sparkles,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<AnalyticsTimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<AnalyticsSummaryKPIs | null>(null);
  const [timeSeries, setTimeSeries] = useState<RevenueDataPoint[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSellingSilhouette[]>([]);
  const [regions, setRegions] = useState<RegionalDistribution[]>([]);

  const loadData = async (selectedRange: AnalyticsTimeRange) => {
    setLoading(true);
    try {
      const data = await fetchAnalyticsData(selectedRange);
      setKpis(data.kpis);
      setTimeSeries(data.timeSeries);
      setBestSellers(data.bestSellers);
      setRegions(data.regions);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(range);
  }, [range]);

  // Chart calculations
  const maxRevenue = Math.max(...timeSeries.map((p) => p.revenue), 100);

  return (
    <div className="space-y-8 animate-fade-in text-white pb-12">
      {/* ── HEADER & RANGE SELECTOR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Performance Telemetry & Financials
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Commercial throughput, demand trajectories, best-selling silhouettes, and geographic delivery distribution.
          </p>
        </div>

        {/* Time Range Pills */}
        <div className="flex items-center gap-1 bg-[#121215] p-1 border border-white/15">
          {(['7d', '30d', '90d', '1y'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-all ${
                range === r
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. FINANCIAL HEALTH KPIS ── */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Revenue */}
          <div className="p-5 bg-[#121215] border border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
              Gross Volume
            </span>
            <p className="text-2xl font-light font-mono text-white mt-1">
              ${kpis.grossRevenue.toFixed(2)}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              <span>Net: ${kpis.netRevenue.toFixed(2)}</span>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="p-5 bg-[#121215] border border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
              Average Order Value (AOV)
            </span>
            <p className="text-2xl font-light font-mono text-white mt-1">
              ${kpis.avgOrderValue.toFixed(2)}
            </p>
            <p className="text-[10px] font-mono text-white/40 mt-2">
              Across {kpis.totalOrders} fulfilled orders
            </p>
          </div>

          {/* Units Sold */}
          <div className="p-5 bg-[#121215] border border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
              Garments Dispatched
            </span>
            <p className="text-2xl font-light font-mono text-white mt-1">
              {kpis.totalUnitsSold} <span className="text-sm text-white/40">Units</span>
            </p>
            <p className="text-[10px] font-mono text-emerald-400 mt-2">
              Archival long-sleeves demand
            </p>
          </div>

          {/* Return Rate */}
          <div className="p-5 bg-[#121215] border border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
              Return & Claim Rate
            </span>
            <p className="text-2xl font-light font-mono text-amber-300 mt-1">
              {kpis.returnRate.toFixed(1)}%
            </p>
            <p className="text-[10px] font-mono text-white/40 mt-2">
              {kpis.refundsCount} claims (${kpis.refundsTotalAmount.toFixed(2)} refunded)
            </p>
          </div>
        </div>
      )}

      {/* ── 2. DYNAMIC REVENUE & ORDERS CHART ── */}
      <div className="p-6 bg-[#121215] border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-sm font-light uppercase tracking-wider text-white">
              Revenue Curve & Order Volume Trajectory
            </h2>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              Period trajectory ({range}) calibrated across confirmed atelier settlements
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-white" />
              <span className="text-white/60">Revenue ($)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-sky-400" />
              <span className="text-white/60">Orders Count</span>
            </div>
          </div>
        </div>

        {/* Responsive CSS Bar / Area Graphic */}
        <div className="h-64 flex items-end gap-2 sm:gap-4 pt-8 pb-4 border-b border-white/10">
          {timeSeries.map((pt, idx) => {
            const heightPercent = maxRevenue > 0 ? Math.max(12, (pt.revenue / maxRevenue) * 100) : 10;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                <div className="absolute -top-12 bg-[#1C1C22] border border-white/20 p-2 text-center text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-xl">
                  <p className="font-bold text-white">${pt.revenue.toFixed(2)}</p>
                  <p className="text-sky-300">{pt.orders} orders · {pt.label}</p>
                </div>

                {/* Revenue Column */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className="w-full bg-gradient-to-t from-white/10 via-white/40 to-white hover:to-amber-300 transition-all cursor-pointer relative"
                >
                  {/* Subtle order indicator dot */}
                  {pt.orders > 0 && (
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                </div>

                {/* Label */}
                <span className="text-[9px] font-mono text-white/40 mt-2 transform -rotate-45 sm:rotate-0 truncate max-w-[48px] sm:max-w-none text-center">
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. BEST SELLERS & GEOGRAPHIC DISTRIBUTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Best-Selling Silhouettes */}
        <div className="p-6 bg-[#121215] border border-white/10 space-y-4">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-sm font-light uppercase tracking-wider text-white">
              Best-Selling Silhouettes & Variants
            </h2>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              Ranked automatically by confirmed client order volume
            </p>
          </div>

          <div className="space-y-4">
            {bestSellers.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 bg-[#151519] border border-white/5 hover:border-white/20 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-white/40 w-4">#{idx + 1}</span>
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    className="w-12 h-14 object-contain bg-white p-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-white truncate max-w-[200px] sm:max-w-xs">
                      {item.product_name}
                    </p>
                    <p className="text-[10px] font-mono text-white/50 mt-1">
                      Top Variant: Size <strong className="text-white">{item.top_size}</strong> · {item.top_color}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs flex-shrink-0">
                  <p className="font-bold text-white">{item.total_revenue.toFixed(2)} EGP</p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">{item.units_sold} garments sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Egyptian Geographic Distribution */}
        <div className="p-6 bg-[#121215] border border-white/10 space-y-4">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-sm font-light uppercase tracking-wider text-white">
              Regional Delivery Distribution
            </h2>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              Geographic delivery volume across Egyptian governorates
            </p>
          </div>

          <div className="space-y-5 font-mono">
            {regions.map((reg) => (
              <div key={reg.region} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-medium">{reg.region}</span>
                  <span className="text-white/70">{reg.percentage}% ({reg.ordersCount} orders)</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/5 border border-white/10 overflow-hidden">
                  <div
                    style={{ width: `${reg.percentage}%` }}
                    className="h-full bg-gradient-to-r from-white/40 to-white transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <span>Gross intake: ${reg.revenue.toFixed(2)}</span>
                  <span>Domestic carrier: Bosta / Aramex</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
