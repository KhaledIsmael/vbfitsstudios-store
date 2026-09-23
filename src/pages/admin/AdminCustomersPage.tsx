import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminCustomers,
  fetchCustomerDetail,
  type CustomerSummaryItem,
  type CustomerDetail,
  type CustomerRole
} from '../../lib/adminCustomers';
import { CustomerDetailDrawer } from '../../components/admin/CustomerDetailDrawer';
import {
  Search,
  Users,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Sparkles,
  ShoppingBag,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'support' | 'admin' | 'vip'>('all');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'points' | 'recent'>('recent');

  // Selected customer for the slide-over drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // When selectedCustomerId changes, fetch the customer's detailed record (orders, returns, addresses)
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerDetail(null);
      return;
    }

    let isMounted = true;
    setDrawerLoading(true);

    fetchCustomerDetail(selectedCustomerId).then((detail) => {
      if (isMounted) {
        setCustomerDetail(detail);
        setDrawerLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedCustomerId]);

  // Callback when role is changed inside the drawer
  const handleRoleChanged = (customerId: string, newRole: CustomerRole) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, role: newRole } : c))
    );
    if (customerDetail && customerDetail.id === customerId) {
      setCustomerDetail({ ...customerDetail, role: newRole });
    }
  };

  // Callback when loyalty points are updated inside the drawer
  const handlePointsChanged = (customerId: string, newPoints: number) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, loyalty_points: newPoints } : c))
    );
    if (customerDetail && customerDetail.id === customerId) {
      setCustomerDetail({ ...customerDetail, loyalty_points: newPoints });
    }
  };

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Filter by role or VIP status
    if (roleFilter === 'customer') {
      result = result.filter((c) => c.role === 'customer');
    } else if (roleFilter === 'support') {
      result = result.filter((c) => c.role === 'support');
    } else if (roleFilter === 'admin') {
      result = result.filter((c) => c.role === 'admin');
    } else if (roleFilter === 'vip') {
      result = result.filter((c) => c.lifetime_spent >= 500);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          c.id.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'spent') return b.lifetime_spent - a.lifetime_spent;
      if (sortBy === 'orders') return b.orders_count - a.orders_count;
      if (sortBy === 'points') return b.loyalty_points - a.loyalty_points;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [customers, roleFilter, searchQuery, sortBy]);

  // Aggregate KPI metrics
  const totalClients = customers.length;
  const vipClientsCount = customers.filter((c) => c.lifetime_spent >= 500).length;
  const staffCount = customers.filter((c) => c.role === 'admin' || c.role === 'support').length;
  const totalCirculatingPoints = customers.reduce((acc, c) => acc + (c.loyalty_points || 0), 0);

  const getRoleBadge = (role: CustomerRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-mono uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
            <ShieldAlert className="w-2.5 h-2.5 text-zinc-300" />
            Admin
          </span>
        );
      case 'support':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-mono uppercase bg-sky-950/40 text-sky-300 border border-sky-500/30">
            <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />
            Support
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-mono uppercase bg-white/5 text-white/70 border border-white/10">
            <UserCheck className="w-2.5 h-2.5 text-white/40" />
            Client
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Client Directory & Loyalty
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Manage client profiles, privilege roles, complete order records, returns, and Phase 6 loyalty balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadCustomers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-[#151519] border border-white/10 hover:border-white/30 text-xs font-mono uppercase text-white/80 hover:text-white transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#121215] border border-white/10">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Clients</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-light font-mono text-white mt-1">{totalClients}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Registered profiles</span>
        </div>

        <div className="p-4 bg-[#121215] border border-white/10">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">VIP Spenders (5,000+ EGP)</span>
            <span className="text-[10px] font-mono">Tier 1</span>
          </div>
          <p className="text-2xl font-light font-mono text-emerald-300 mt-1">{vipClientsCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">High lifetime value</span>
        </div>

        <div className="p-4 bg-[#121215] border border-white/10">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Staff & Admin Accounts</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-light font-mono text-sky-300 mt-1">{staffCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Privileged operators</span>
        </div>

        <div className="p-4 bg-[#121215] border border-zinc-700">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-[10px] font-mono uppercase tracking-wider">Circulating Loyalty</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-2xl font-light font-mono text-white mt-1">
            {totalCirculatingPoints.toLocaleString()} <span className="text-xs font-normal">Pts</span>
          </p>
          <span className="text-[10px] font-mono text-zinc-400 mt-1 block">Phase 6 Loyalty Program</span>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#121215] p-3 border border-white/10">
        {/* Search Bar */}
        <div className="flex-1 flex items-center gap-2.5 bg-[#18181D] border border-white/10 px-3 py-2">
          <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, email, telephone or client ID..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[10px] font-mono text-white/40 hover:text-white uppercase"
            >
              Clear
            </button>
          )}
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 bg-[#18181D] p-1 border border-white/10">
          {[
            { id: 'all', label: 'All Clients' },
            { id: 'vip', label: 'VIP (5,000+ EGP)' },
            { id: 'customer', label: 'Customers' },
            { id: 'support', label: 'Support' },
            { id: 'admin', label: 'Admins' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                roleFilter === tab.id
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase text-white/40 hidden xl:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#18181D] border border-white/10 text-white text-xs font-mono py-2 px-3 focus:outline-none uppercase"
          >
            <option value="recent">Joined Recently</option>
            <option value="spent">Lifetime Spend</option>
            <option value="orders">Orders Count</option>
            <option value="points">Loyalty Points</option>
          </select>
        </div>
      </div>

      {/* 4. Main Customers Table */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[10px]">
              <th className="py-3 px-4">Client Identity</th>
              <th className="py-3 px-4">Contact Details</th>
              <th className="py-3 px-4">Role Privileges</th>
              <th className="py-3 px-4">Orders & Spend</th>
              <th className="py-3 px-4">Loyalty Points</th>
              <th className="py-3 px-4">Member Since</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-white/40 font-mono">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-white/50" />
                    <span>Loading atelier client directory...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-white/40 font-mono">
                  No client records matching current query or filters.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Identity & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={c.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-mono font-bold text-white uppercase">
                              {c.full_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{c.full_name}</p>
                          <p className="text-[10px] text-white/40 font-mono">
                            ID: {c.id.slice(0, 12)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 font-mono">
                      <p className="text-white/90 text-xs">{c.email}</p>
                      <p className="text-white/40 text-[10px]">{c.phone || 'No phone'}</p>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">{getRoleBadge(c.role)}</td>

                    {/* Orders & Spend */}
                    <td className="py-3.5 px-4 font-mono">
                      <p className="text-white font-semibold">
                        ${c.lifetime_spent.toFixed(2)}
                      </p>
                      <p className="text-white/40 text-[10px]">
                        {c.orders_count} {c.orders_count === 1 ? 'order' : 'orders'}
                      </p>
                    </td>

                    {/* Loyalty Points */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="inline-flex items-center gap-1 text-zinc-200 font-bold">
                        <Sparkles className="w-3 h-3 text-zinc-400" />
                        {c.loyalty_points} Pts
                      </span>
                    </td>

                    {/* Member Since */}
                    <td className="py-3.5 px-4 font-mono text-white/50 text-[11px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(c.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono uppercase bg-[#18181D] hover:bg-white/10 text-white/80 hover:text-white border border-white/15 transition-colors"
                      >
                        <span>History & Role</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Slide-over Client Profile & History Drawer */}
      {selectedCustomerId && customerDetail && (
        <CustomerDetailDrawer
          customer={customerDetail}
          onClose={() => setSelectedCustomerId(null)}
          onRoleChanged={handleRoleChanged}
          onPointsChanged={handlePointsChanged}
        />
      )}

      {/* Drawer Loading Overlay if active */}
      {selectedCustomerId && drawerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-[#151519] border border-white/15 p-6 flex items-center gap-3 text-white font-mono text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-white/70" />
            <span>Retrieving client profile, order archives, and return requests...</span>
          </div>
        </div>
      )}
    </div>
  );
};
