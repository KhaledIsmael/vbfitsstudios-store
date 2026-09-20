import React, { useState, useEffect } from 'react';
import {
  fetchReturnRequests,
  updateReturnRequestStatus,
  issueDirectReturnRefund,
  type ReturnRequestItem,
  type ReturnStatus
} from '../../lib/adminReturns';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Truck,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export const AdminReturnsPage: React.FC = () => {
  const [requests, setRequests] = useState<ReturnRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ReturnStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection modal
  const [rejectModalItem, setRejectModalItem] = useState<ReturnRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Refund modal
  const [refundModalItem, setRefundModalItem] = useState<ReturnRequestItem | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const data = await fetchReturnRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load return requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  // Actions
  const handleApprove = async (item: ReturnRequestItem) => {
    await updateReturnRequestStatus(
      item.id,
      'approved',
      'Return approved by atelier operations. Courier dispatch scheduled.'
    );
    setRequests((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'approved' } : r))
    );
  };

  const handleMarkCollected = async (item: ReturnRequestItem) => {
    await updateReturnRequestStatus(
      item.id,
      'collected',
      'Courier collected returned garment; safely received at logistics hub.'
    );
    setRequests((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'collected' } : r))
    );
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    await updateReturnRequestStatus(
      rejectModalItem.id,
      'rejected',
      rejectReason || 'Return request denied per atelier return policy guidelines.'
    );
    setRequests((prev) =>
      prev.map((r) => (r.id === rejectModalItem.id ? { ...r, status: 'rejected' } : r))
    );
    setRejectModalItem(null);
    setRejectReason('');
  };

  const handleConfirmRefund = async () => {
    if (!refundModalItem) return;
    setRefundSubmitting(true);
    await issueDirectReturnRefund(
      refundModalItem.id,
      refundModalItem.order_id,
      refundAmount,
      refundModalItem.reason
    );
    setRequests((prev) =>
      prev.map((r) => (r.id === refundModalItem.id ? { ...r, status: 'refunded' } : r))
    );
    setRefundSubmitting(false);
    setRefundModalItem(null);
  };

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.order_number.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      r.customer_email.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // KPI counters
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const collectedCount = requests.filter((r) => r.status === 'collected').length;
  const refundedCount = requests.filter((r) => r.status === 'refunded').length;

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-amber-950/40 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-sky-950/40 text-sky-300 border border-sky-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Approved
          </span>
        );
      case 'collected':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-purple-950/40 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1">
            <Truck className="w-2.5 h-2.5" />
            Courier Collected
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" />
            Refund Issued
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-red-950/40 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-light uppercase tracking-wider text-white">
            Returns, Exchanges & Claims Hub
          </h1>
          <p className="text-xs text-white/50 tracking-wide mt-1">
            Process client return claims, authorize courier pickups, inspect parcels, and settle financial refunds.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReturns}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-[#151519] border border-white/15 hover:border-white/30 text-xs font-mono uppercase text-white/80 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Requests</span>
        </button>
      </div>

      {/* ── KPI METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-[#121215] border border-amber-500/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
            Awaiting Review
          </span>
          <p className="text-2xl font-light font-mono text-amber-300 mt-1">{pendingCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Requires staff action</span>
        </div>

        <div className="p-4 bg-[#121215] border border-sky-500/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 block">
            Approved & In-Transit
          </span>
          <p className="text-2xl font-light font-mono text-sky-300 mt-1">{approvedCount + collectedCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Awaiting hub inspection</span>
        </div>

        <div className="p-4 bg-[#121215] border border-emerald-500/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block">
            Refunds Settled
          </span>
          <p className="text-2xl font-light font-mono text-emerald-300 mt-1">{refundedCount}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Successfully reconciled</span>
        </div>

        <div className="p-4 bg-[#121215] border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
            Total Claims Handled
          </span>
          <p className="text-2xl font-light font-mono text-white mt-1">{requests.length}</p>
          <span className="text-[10px] font-mono text-white/40 mt-1 block">Across all orders</span>
        </div>
      </div>

      {/* ── SEARCH & STATUS FILTERS ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#121215] p-3 border border-white/10">
        <div className="flex-1 flex items-center gap-2.5 bg-[#18181D] border border-white/10 px-3 py-2">
          <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, client name, email, or reason..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 bg-[#18181D] p-1 border border-white/10">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'collected', label: 'Collected' },
            { id: 'refunded', label: 'Refunded' },
            { id: 'rejected', label: 'Rejected' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN RETURNS QUEUE TABLE ── */}
      <div className="border border-white/10 bg-[#121215] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest font-mono text-[10px]">
              <th className="py-3 px-4">Order Ref & Date</th>
              <th className="py-3 px-4">Client Identity</th>
              <th className="py-3 px-4">Claim Reason & Note</th>
              <th className="py-3 px-4">Claimed Items</th>
              <th className="py-3 px-4">Claim Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Operational Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-white/40">Loading return claims queue...</td></tr>
            ) : filteredRequests.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-white/40 font-sans">No return requests found.</td></tr>
            ) : (
              filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Order Ref */}
                  <td className="py-3.5 px-4 font-bold text-white">
                    <p>#{r.order_number}</p>
                    <p className="text-[10px] text-white/40 font-normal">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </td>

                  {/* Client Identity */}
                  <td className="py-3.5 px-4">
                    <p className="text-white font-medium">{r.customer_name}</p>
                    <p className="text-[10px] text-white/50">{r.customer_email}</p>
                    {r.customer_phone && <p className="text-[10px] text-white/40">{r.customer_phone}</p>}
                  </td>

                  {/* Reason & Customer Note */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <span className="text-white font-medium uppercase text-[10px] tracking-wider bg-white/10 px-1.5 py-0.5 border border-white/10">
                      {r.reason.replace(/_/g, ' ')}
                    </span>
                    {r.reason_note && (
                      <p className="text-[11px] text-white/60 italic mt-1 font-sans line-clamp-2">
                        "{r.reason_note}"
                      </p>
                    )}
                    {r.staff_notes && (
                      <p className="text-[10px] text-sky-400/80 mt-1 font-mono">
                        Note: {r.staff_notes}
                      </p>
                    )}
                  </td>

                  {/* Items */}
                  <td className="py-3.5 px-4 text-xs">
                    {r.items.map((it, idx) => (
                      <div key={idx} className="text-white/80">
                        <span>{it.quantity_to_return}x {it.name}</span>
                        <span className="text-white/40 text-[10px] ml-1">({it.size})</span>
                      </div>
                    ))}
                  </td>

                  {/* Claim Amount */}
                  <td className="py-3.5 px-4 font-bold text-white">
                    ${(r.refund_amount || 0).toFixed(2)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">{getStatusBadge(r.status)}</td>

                  {/* Operational Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            className="px-2.5 py-1 text-[10px] uppercase font-mono bg-sky-950/40 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalItem(r);
                              setRejectReason('');
                            }}
                            className="px-2.5 py-1 text-[10px] uppercase font-mono bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {r.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleMarkCollected(r)}
                          className="px-2.5 py-1 text-[10px] uppercase font-mono bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                          Mark Collected
                        </button>
                      )}

                      {(r.status === 'collected' || r.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundModalItem(r);
                            setRefundAmount(r.refund_amount || 180);
                          }}
                          className="px-2.5 py-1 text-[10px] uppercase font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                        >
                          Issue Refund
                        </button>
                      )}

                      {r.status === 'refunded' && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          Completed ✓
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── REJECT MODAL ── */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#151519] border border-white/15 p-6 space-y-4 shadow-2xl text-white font-mono text-xs">
            <h3 className="text-sm font-light uppercase tracking-wider text-red-300">
              Reject Return Claim #{rejectModalItem.order_number}
            </h3>
            <p className="text-white/60">
              Please enter the internal operational reason for rejecting this customer claim:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="E.g., Claim submitted past the 14-day archival return window..."
              className="w-full bg-[#101014] border border-white/15 p-3 text-xs text-white focus:outline-none focus:border-red-400"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="px-4 py-2 border border-white/15 text-white/60 hover:text-white uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 text-white font-semibold uppercase hover:bg-red-500 transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFUND MODAL ── */}
      {refundModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#151519] border border-emerald-500/30 p-6 space-y-4 shadow-2xl text-white font-mono text-xs">
            <h3 className="text-sm font-light uppercase tracking-wider text-emerald-300">
              Disburse Refund Settlement — #{refundModalItem.order_number}
            </h3>
            <p className="text-white/60">
              Confirm refund disbursement to client <strong>{refundModalItem.customer_name}</strong>:
            </p>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-white/50 block">Refund Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#101014] border border-white/15 p-3 text-sm font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalItem(null)}
                disabled={refundSubmitting}
                className="px-4 py-2 border border-white/15 text-white/60 hover:text-white uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={refundSubmitting}
                className="px-5 py-2 bg-emerald-500 text-black font-bold uppercase hover:bg-emerald-400 transition-colors shadow"
              >
                {refundSubmitting ? 'Processing...' : 'Authorize Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
