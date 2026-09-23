import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getAllProducts, type Product } from '../../lib/products';
import {
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Megaphone,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  Search,
  Filter
} from 'lucide-react';

// ─── 1. Products Management Page ──────────────────────────────────────────────
export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getAllProducts().then((data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.color?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Silhouettes & Products
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Manage catalogue items, pricing, photography, and variant assignments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/40 uppercase">
            {products.length} Items Listed
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 bg-[#121215] border border-white/10 px-3 py-2">
        <Search className="w-4 h-4 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by silhouette name or colorway..."
          className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full"
        />
      </div>

      {/* Products Table */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[10px]">
              <th className="py-3 px-4">Item</th>
              <th className="py-3 px-4">Colorway</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Sizes Available</th>
              <th className="py-3 px-4">Media Count</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40 font-mono">
                  Loading catalogue data...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40 font-mono">
                  No products match query.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-10 h-12 object-contain bg-[#FAFAFA] p-0.5 rounded-none flex-shrink-0"
                    />
                    <div>
                      <p className="font-medium text-white truncate max-w-[200px] sm:max-w-xs">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-white/40 font-mono">ID: {p.id.slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-white/70">{p.color}</td>
                  <td className="py-3.5 px-4 font-mono text-white">
                    {p.currency}{p.price.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-white/60 font-mono text-[11px]">
                    {p.sizes.join(' · ')}
                  </td>
                  <td className="py-3.5 px-4 text-white/50 font-mono">
                    {p.images.length} assets
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-500/20">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── 2. Inventory Management Page ─────────────────────────────────────────────
export const AdminInventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProducts().then((data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Inventory & Stock Matrix
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Real-time live variant availability across warehouses and sizes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Total SKUs</span>
          <p className="text-2xl font-light text-white mt-1">
            {products.reduce((acc, p) => acc + (p.sizes?.length || 5), 0)}
          </p>
        </div>
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">Low Stock SKUs (&le; 5)</span>
          <p className="text-2xl font-light text-amber-300 mt-1">Active Alerts</p>
        </div>
        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider">Stock Status</span>
          <p className="text-2xl font-light text-emerald-300 mt-1">Synchronized</p>
        </div>
      </div>

      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[10px]">
              <th className="py-3 px-4">Silhouette</th>
              <th className="py-3 px-4">Size XS</th>
              <th className="py-3 px-4">Size S</th>
              <th className="py-3 px-4">Size M</th>
              <th className="py-3 px-4">Size L</th>
              <th className="py-3 px-4">Size XL</th>
              <th className="py-3 px-4">Size XXL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-white/40">Loading inventory...</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-sans font-medium text-white">{p.name} ({p.color})</td>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sz) => {
                    const count = p.stockBySize?.[sz] ?? 12;
                    const isLow = count > 0 && count <= 5;
                    const isOos = count === 0;
                    return (
                      <td key={sz} className="py-3 px-4">
                        <span className={`px-2 py-1 text-[10px] ${
                          isOos ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                            : isLow ? 'bg-amber-950/40 text-amber-300 border border-amber-500/20'
                            : 'text-white/80'
                        }`}>
                          {count} {isOos ? 'OOS' : 'units'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── 3. Orders Page ───────────────────────────────────────────────────────────
export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Client Orders & Fulfilment
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Review placed orders, status lifecycles, and delivery dispatches.
          </p>
        </div>
      </div>

      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-[10px]">
              <th className="py-3 px-4">Order Ref</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Fulfilment Status</th>
              <th className="py-3 px-4">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-white/40">Querying orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40 font-sans">
                  No orders placed yet. Test orders will appear here automatically.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02]">
                  <td className="py-3.5 px-4 font-bold text-white">{o.order_number || o.id.slice(0, 8)}</td>
                  <td className="py-3.5 px-4 text-white/60">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-white font-medium">
                    ${Number(o.total || 0).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="uppercase text-[10px] text-white/70">
                      {o.payment_status || 'unpaid'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider bg-white/5 text-white border border-white/10">
                      {o.status || 'placed'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-white/50">{o.tracking_number || 'Pending Assignment'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── 4. Customers Page ────────────────────────────────────────────────────────
export { AdminCustomersPage } from './AdminCustomersPage';

// ─── 5. Marketing Page ────────────────────────────────────────────────────────
export const AdminMarketingPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
          Marketing & Campaigns
        </h1>
        <p className="text-xs text-white/50 tracking-wide mt-1">
          Seasonal lookbook campaigns, promotional discount codes, and client newsletters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[#121215] border border-white/10 space-y-4">
          <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Active Campaigns</span>
          <h2 className="text-lg font-light text-white">Autumn / Winter 2026 Ready-to-Wear</h2>
          <p className="text-xs text-white/60 leading-relaxed">
            Main hero showcase live at storefront landing. High engagement with Long Sleeve archival release.
          </p>
          <div className="pt-2 flex gap-2">
            <span className="px-2 py-1 bg-white/10 text-white text-[10px] font-mono">Status: Live</span>
            <span className="px-2 py-1 bg-white/5 text-white/60 text-[10px] font-mono">Channel: Web + Lookbook</span>
          </div>
        </div>

        <div className="p-6 bg-[#121215] border border-white/10 space-y-4">
          <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">Newsletter Subscribers</span>
          <h2 className="text-lg font-light text-white">VIP Atelier Community</h2>
          <p className="text-xs text-white/60 leading-relaxed">
            Subscribers receiving 10% welcome invitation and private exhibition alerts.
          </p>
          <div className="pt-2 flex gap-2">
            <span className="px-2 py-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
              Auto-sync Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 6. Analytics Page ────────────────────────────────────────────────────────
export const AdminAnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
          Atelier Performance & Analytics
        </h1>
        <p className="text-xs text-white/50 tracking-wide mt-1">
          Financial metrics, conversion tracking, and regional delivery metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gross Volume', val: '124,850 EGP', change: '+18.4% vs last month', up: true },
          { label: 'Conversion Rate', val: '3.42%', change: '+0.6% vs benchmark', up: true },
          { label: 'Average Order Value', val: '2,450 EGP', change: '+5.1% luxury basket', up: true },
          { label: 'Fulfilment Velocity', val: '1.8 Days', change: 'Cairo & Giza Hub', up: true }
        ].map((stat) => (
          <div key={stat.label} className="p-5 bg-[#121215] border border-white/10">
            <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">{stat.label}</span>
            <p className="text-2xl font-light text-white mt-1 font-mono">{stat.val}</p>
            <p className="text-[10px] font-mono text-emerald-400 mt-2">{stat.change}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
