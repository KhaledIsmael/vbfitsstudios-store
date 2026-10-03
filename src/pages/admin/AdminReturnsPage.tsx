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
  const [refundTransactionRef, setRefundTransactionRef] = useState('');

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
    if (!refundTransactionRef.trim()) {
      alert('يرجى إدخال رقم المعاملة البنكية / المحفظة.');
      return;
    }
    setRefundSubmitting(true);
    await issueDirectReturnRefund(
      refundModalItem.id,
      refundModalItem.order_id,
      refundAmount,
      refundTransactionRef.trim(),
      refundModalItem.reason,
      refundModalItem.customer_email,
      refundModalItem.customer_name,
      refundModalItem.order_number,
      refundModalItem.refund_method
    );
    setRequests((prev) =>
      prev.map((r) => (r.id === refundModalItem.id ? { ...r, status: 'refunded', refund_transaction_ref: refundTransactionRef.trim(), refund_amount: refundAmount } : r))
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
          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-700 rounded-full inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            قيد المراجعة
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            تم الموافقة
          </span>
        );
      case 'collected':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-purple-100 text-purple-700 rounded-full inline-flex items-center gap-1">
            <Truck className="w-2.5 h-2.5" />
            تم الاستلام
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded-full inline-flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" />
            تم الاسترداد
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-red-100 text-red-700 rounded-full inline-flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5" />
            مرفوض
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 pb-12" dir="rtl">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
            <a href="/admin" className="hover:text-blue-600 transition-colors">الرئيسية</a>
            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            <span className="text-slate-900">المرتجعات والشكاوى</span>
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-slate-900">
            المرتجعات والشكاوى
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            إدارة طلبات الإرجاع، ومتابعة الاستلام من المندوب، وتنفيذ الاسترداد المالي للعملاء.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReturns}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الطلبات</span>
        </button>
      </div>

      {/* ── KPI METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            في انتظار المراجعة
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{pendingCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">تتطلب اتخاذ إجراء</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-blue-600 block">
            تمت الموافقة / قيد الشحن
          </span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{approvedCount + collectedCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">بانتظار الفحص</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-emerald-600 block">
            مرتجعات مكتملة
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{refundedCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">مبالغ مستردة</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            إجمالي الطلبات
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{requests.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">في جميع الحالات</span>
        </div>
      </div>

      {/* ── SEARCH & STATUS FILTERS ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
        <div className="flex-1 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الطلب، اسم العميل، البريد الإلكتروني، أو السيريال..."
            className="bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'pending', label: 'قيد المراجعة' },
            { id: 'approved', label: 'موافق عليه' },
            { id: 'collected', label: 'تم الاستلام' },
            { id: 'refunded', label: 'مسترد' },
            { id: 'rejected', label: 'مرفوض' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-black shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN RETURNS QUEUE TABLE ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
              <th className="py-3 px-4">رقم الطلب والتاريخ</th>
              <th className="py-3 px-4">بيانات العميل</th>
              <th className="py-3 px-4">سبب الإرجاع والملاحظات</th>
              <th className="py-3 px-4">المنتجات المسترجعة</th>
              <th className="py-3 px-4">مبلغ الاسترداد</th>
              <th className="py-3 px-4">الحالة</th>
              <th className="py-3 px-4 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400">جاري تحميل الطلبات...</td></tr>
            ) : filteredRequests.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400 font-sans">لا توجد طلبات إرجاع.</td></tr>
            ) : (
              filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  {/* Order Ref */}
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <p>#{r.order_number}</p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </td>

                  {/* Client Identity */}
                  <td className="py-3.5 px-4">
                    <p className="text-slate-900 font-bold">{r.customer_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{r.customer_email}</p>
                    {r.customer_phone && <p className="text-[10px] text-slate-400 font-medium">{r.customer_phone}</p>}
                  </td>

                  {/* Reason & Customer Note */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <span className="text-slate-700 font-bold uppercase text-[10px] tracking-wider bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {r.reason.replace(/_/g, ' ')}
                    </span>
                    {r.reason_note && (
                      <p className="text-[11px] text-slate-600 italic mt-2 font-sans line-clamp-2 leading-relaxed">
                        "{r.reason_note}"
                      </p>
                    )}
                    {r.staff_notes && (
                      <p className="text-[10px] text-blue-600 mt-1 font-mono font-medium">
                        Note: {r.staff_notes}
                      </p>
                    )}
                  </td>

                  {/* Items */}
                  <td className="py-3.5 px-4 text-xs font-medium">
                    {r.items.map((it, idx) => (
                      <div key={idx} className="text-slate-700">
                        <span>{it.quantity_to_return}x {it.name}</span>
                        <span className="text-slate-400 text-[10px] font-bold ml-1">({it.size})</span>
                      </div>
                    ))}
                  </td>

                  {/* Claim Amount & Details */}
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">
                      EGP {(r.refund_amount || 0).toFixed(2)}
                    </p>
                    {r.refund_method && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          طريقة الاسترداد: {r.refund_method.replace(/_/g, ' ')}
                        </span>
                        {r.refund_account_details?.details && (
                          <span className="text-[10px] text-slate-600 block bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 break-all">
                            {r.refund_account_details.details}
                          </span>
                        )}
                        {r.refund_transaction_ref && (
                          <span className="text-[10px] text-emerald-600 font-mono block">
                            Ref: {r.refund_transaction_ref}
                          </span>
                        )}
                      </div>
                    )}
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
                            className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors rounded-lg shadow-sm"
                          >
                            موافقة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalItem(r);
                              setRejectReason('');
                            }}
                            className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors rounded-lg shadow-sm"
                          >
                            رفض
                          </button>
                        </>
                      )}

                      {r.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleMarkCollected(r)}
                          className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors rounded-lg shadow-sm"
                        >
                          تأكيد الاستلام
                        </button>
                      )}

                      {(r.status === 'collected' || r.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundModalItem(r);
                            setRefundAmount(r.refund_amount || 0);
                            setRefundTransactionRef('');
                          }}
                          className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors rounded-lg shadow-sm"
                        >
                          استرداد المبلغ
                        </button>
                      )}

                      {r.status === 'refunded' && (
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                          مكتمل ✓
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              رفض طلب الإرجاع #{rejectModalItem.order_number}
            </h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              يرجى إدخال سبب الرفض الداخلي (لن يتم إرساله للعميل مباشرة ولكن يستخدم كسجل للعمليات):
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: تم تقديم الطلب بعد انتهاء فترة الـ 14 يوم..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 placeholder-slate-400 resize-none"
            />
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-50 uppercase tracking-wider transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors shadow-sm"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXECUTIVE REFUND DISBURSEMENT MODAL ── */}
      {refundModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-0 overflow-hidden shadow-2xl text-slate-900 flex flex-col">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Financial Disbursement — #{refundModalItem.order_number}
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Target Payout Card */}
              <div className="bg-slate-900 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Payout Target Profile</h4>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium mb-1">Customer</p>
                    <p className="text-sm font-bold">{refundModalItem.customer_name}</p>
                  </div>
                  
                  <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">
                        {refundModalItem.refund_method?.replace(/_/g, ' ') || 'Original Payment'}
                      </p>
                      <p className="text-sm font-mono font-bold tracking-wide text-emerald-400">
                        {refundModalItem.refund_account_details?.details || 'N/A'}
                      </p>
                    </div>
                    {refundModalItem.refund_account_details?.details && (
                      <button 
                        onClick={() => navigator.clipboard.writeText(refundModalItem.refund_account_details.details)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] uppercase font-bold tracking-wider rounded-md transition-colors flex items-center gap-1.5"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Authorized Amount (EGP)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-emerald-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Transaction Code (Ref) *
                  </label>
                  <input
                    type="text"
                    value={refundTransactionRef}
                    onChange={(e) => setRefundTransactionRef(e.target.value)}
                    placeholder="TRX-..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundModalItem(null)}
                disabled={refundSubmitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-50 uppercase tracking-wider transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={refundSubmitting}
                className="px-5 py-2 bg-emerald-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {refundSubmitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {refundSubmitting ? 'جاري التنفيذ...' : 'تأكيد الاسترداد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
