import React, { useState } from 'react';
import {
  CustomerDetail,
  CustomerRole,
  updateCustomerRole,
  updateCustomerLoyaltyPoints
} from '../../lib/adminCustomers';
import {
  X,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Check,
  CreditCard,
  Plus
} from 'lucide-react';

interface CustomerDetailDrawerProps {
  customer: CustomerDetail;
  onClose: () => void;
  onRoleChanged: (customerId: string, newRole: CustomerRole) => void;
  onPointsChanged: (customerId: string, newPoints: number) => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  onClose,
  onRoleChanged,
  onPointsChanged
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'returns' | 'addresses'>('orders');
  const [currentRole, setCurrentRole] = useState<CustomerRole>(customer.role);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleSuccess, setRoleSuccess] = useState(false);

  const [points, setPoints] = useState(customer.loyalty_points);
  const [pointsAdding, setPointsAdding] = useState(false);

  const handleRoleSelect = async (role: CustomerRole) => {
    if (role === currentRole) return;
    setRoleUpdating(true);
    const { success } = await updateCustomerRole(customer.id, role);
    if (success) {
      setCurrentRole(role);
      onRoleChanged(customer.id, role);
      setRoleSuccess(true);
      setTimeout(() => setRoleSuccess(false), 2000);
    }
    setRoleUpdating(false);
  };

  const handleAddBonusPoints = async (bonus: number) => {
    const newTotal = points + bonus;
    setPoints(newTotal);
    await updateCustomerLoyaltyPoints(customer.id, newTotal);
    onPointsChanged(customer.id, newTotal);
  };

  const getRoleIcon = (role: CustomerRole) => {
    if (role === 'admin') return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
    if (role === 'support') return <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />;
    return <User className="w-3.5 h-3.5 text-white/50" />;
  };

  const avgOrderValue =
    customer.orders_count > 0 ? customer.lifetime_spent / customer.orders_count : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-[#121215] border-l border-white/10 flex flex-col shadow-2xl text-white">
          {/* Header */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#151519]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Client Profile
              </span>
              <span className="text-xs text-white/20">/</span>
              <span className="text-xs font-mono text-white/80">{customer.email}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. PROFILE HEADER & ROLE SWITCHER */}
            <div className="p-5 bg-[#151519] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {customer.avatar_url ? (
                      <img
                        src={customer.avatar_url}
                        alt={customer.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-white uppercase">
                        {customer.full_name.charAt(0)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-light uppercase tracking-wider text-white">
                      {customer.full_name}
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-0.5">{customer.email}</p>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">
                      Tel: {customer.phone} · Joined {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* ROLE SWITCHER */}
                <div className="space-y-1.5 text-right sm:text-right">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                    Access Privileges
                  </span>
                  <div className="flex items-center gap-1 bg-[#101014] p-1 border border-white/15">
                    {(['customer', 'support', 'admin'] as const).map((r) => {
                      const isSelected = currentRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={roleUpdating}
                          onClick={() => handleRoleSelect(r)}
                          className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1 ${
                            isSelected
                              ? r === 'admin'
                                ? 'bg-amber-400 text-black font-bold shadow'
                                : r === 'support'
                                ? 'bg-sky-400 text-black font-bold shadow'
                                : 'bg-white text-black font-bold shadow'
                              : 'text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{r}</span>
                        </button>
                      );
                    })}
                  </div>
                  {roleSuccess && (
                    <span className="text-[10px] font-mono text-emerald-400 block animate-fade-in">
                      ✓ Role updated successfully
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. METRICS & LOYALTY POINTS (PHASE 6) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#151519] border border-white/10">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                  Lifetime Orders
                </span>
                <span className="text-xl font-light font-mono text-white mt-1 block">
                  {customer.orders_count}
                </span>
              </div>

              <div className="p-3.5 bg-[#151519] border border-white/10">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                  Total Spend
                </span>
                <span className="text-xl font-light font-mono text-white mt-1 block">
                  ${customer.lifetime_spent.toFixed(2)}
                </span>
              </div>

              <div className="p-3.5 bg-[#151519] border border-white/10">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">
                  Avg Basket Value
                </span>
                <span className="text-xl font-light font-mono text-white/80 mt-1 block">
                  ${avgOrderValue.toFixed(2)}
                </span>
              </div>

              {/* LOYALTY POINTS BANNER */}
              <div className="p-3.5 bg-[#151519] border border-amber-500/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-amber-300 block">
                    Loyalty Points
                  </span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold font-mono text-amber-300">
                    {points} Pts
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddBonusPoints(50)}
                    className="text-[9px] font-mono uppercase bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 px-1.5 py-0.5 border border-amber-500/30 transition-colors"
                    title="Reward 50 VIP loyalty points"
                  >
                    +50
                  </button>
                </div>
              </div>
            </div>

            {/* 3. TAB NAVIGATION */}
            <div className="flex border-b border-white/10 bg-[#0E0E10] text-xs font-mono uppercase tracking-wider">
              {[
                { id: 'orders', label: `Order History (${customer.orders.length})` },
                { id: 'returns', label: `Returns & Claims (${customer.return_requests.length + customer.refunds.length})` },
                { id: 'addresses', label: `Addresses (${customer.shipping_addresses.length})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2.5 px-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-white text-white font-medium bg-white/5'
                      : 'border-transparent text-white/50 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB 1: FULL ORDER HISTORY ── */}
            {activeTab === 'orders' && (
              <div className="space-y-3 animate-fade-in">
                {customer.orders.length === 0 ? (
                  <p className="p-8 text-center text-xs text-white/40 font-mono bg-[#151519] border border-white/5">
                    No orders registered under this client yet.
                  </p>
                ) : (
                  customer.orders.map((o) => (
                    <div
                      key={o.id}
                      className="p-4 bg-[#151519] border border-white/10 space-y-3 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-white text-sm">#{o.order_number}</span>
                          <span className="text-white/40 text-[10px] ml-2">
                            {new Date(o.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">${o.total.toFixed(2)}</span>
                          <span className="px-2 py-0.5 text-[9px] uppercase font-mono bg-white/10 text-white/80 border border-white/15">
                            {o.status}
                          </span>
                        </div>
                      </div>

                      {/* Items row */}
                      <div className="divide-y divide-white/5 pt-1">
                        {o.items.map((it, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={it.image_url}
                                alt={it.product_name}
                                className="w-8 h-10 object-contain bg-white p-0.5 flex-shrink-0"
                              />
                              <div>
                                <p className="text-white">{it.product_name}</p>
                                <p className="text-[10px] font-mono text-white/40">
                                  Size: {it.size} · {it.color} · Qty: {it.quantity}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-xs text-white/70">
                              ${it.total_price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
                        <span>Payment: {o.payment_method || 'card'} ({o.payment_status})</span>
                        <a
                          href={`/orders/${o.id}/track`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white flex items-center gap-1 underline"
                        >
                          <span>Customer Tracking Timeline</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TAB 2: RETURNS & REFUNDS ── */}
            {activeTab === 'returns' && (
              <div className="space-y-4 animate-fade-in">
                {/* Return Requests */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
                    Return & Exchange Requests ({customer.return_requests.length})
                  </span>

                  {customer.return_requests.length === 0 ? (
                    <p className="p-6 text-center text-xs text-white/40 font-mono bg-[#151519] border border-white/5">
                      No return requests initiated.
                    </p>
                  ) : (
                    customer.return_requests.map((r) => (
                      <div key={r.id} className="p-3.5 bg-[#151519] border border-white/10 text-xs font-mono space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">Order #{r.order_number || r.order_id.slice(0, 8)}</span>
                          <span className="px-2 py-0.5 text-[9px] uppercase bg-amber-950/40 text-amber-300 border border-amber-500/30">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-white/70">Reason: <strong className="text-white">{r.reason.replace(/_/g, ' ')}</strong></p>
                        {r.reason_note && <p className="text-white/50 italic text-[11px]">"{r.reason_note}"</p>}
                        <span className="text-[9px] text-white/30 block">
                          Submitted: {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Refund Claims */}
                <div className="space-y-2 pt-3 border-t border-white/10">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 block">
                    Financial Refunds Dispatched ({customer.refunds.length})
                  </span>

                  {customer.refunds.length === 0 ? (
                    <p className="p-6 text-center text-xs text-white/40 font-mono bg-[#151519] border border-white/5">
                      No refund claims logged.
                    </p>
                  ) : (
                    customer.refunds.map((ref) => (
                      <div key={ref.id} className="p-3.5 bg-[#101014] border border-red-500/20 text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between font-bold text-red-300">
                          <span>Refunded ${ref.amount.toFixed(2)}</span>
                          <span>{new Date(ref.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-white/60">Reason: {ref.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 3: ADDRESSES ── */}
            {activeTab === 'addresses' && (
              <div className="space-y-3 animate-fade-in">
                {customer.shipping_addresses.length === 0 ? (
                  <p className="p-8 text-center text-xs text-white/40 font-mono bg-[#151519] border border-white/5">
                    No delivery address recorded on file.
                  </p>
                ) : (
                  customer.shipping_addresses.map((addr, idx) => (
                    <div key={idx} className="p-4 bg-[#151519] border border-white/10 font-mono text-xs space-y-1">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                        <span className="text-[10px] uppercase text-white/40 font-bold">
                          Delivery Address #{idx + 1}
                        </span>
                        <span className="text-[10px] text-emerald-400">Verified</span>
                      </div>
                      <p className="font-bold text-white text-sm">
                        {addr.first_name} {addr.last_name}
                      </p>
                      <p className="text-white/80">{addr.street_line1}</p>
                      {addr.street_line2 && <p className="text-white/80">{addr.street_line2}</p>}
                      <p className="text-white/80">
                        {addr.city}, {addr.state} {addr.postal_code}
                      </p>
                      <p className="text-white/50 uppercase">{addr.country}</p>
                      <p className="pt-2 text-white font-bold">Tel: {addr.phone || customer.phone}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
