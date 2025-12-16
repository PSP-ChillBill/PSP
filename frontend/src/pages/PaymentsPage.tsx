import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CreditCard, RefreshCw, ArrowUpRight, ArrowDownLeft, X, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments', {
        params: { businessId: user?.businessId },
      });
      setPayments(response.data);
    } catch (error) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleRefundClick = (payment: any) => {
    setSelectedPayment(payment);
    setShowRefundModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <button 
          onClick={loadPayments}
          className="p-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100 transition"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed By
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No payments found</p>
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const amount = parseFloat(payment.amount);
                    const isRefund = amount < 0;
                    
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                          #{payment.orderId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isRefund ? (
                            <span className="flex items-center text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full w-fit">
                              <ArrowDownLeft className="w-3 h-3 mr-1" />
                              Refund
                            </span>
                          ) : (
                            <span className="flex items-center text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full w-fit">
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Sale
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          €{Math.abs(amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.method === 'GiftCard' ? (
                            <span title={payment.giftCard?.code}>
                              Gift Card {payment.giftCard?.code && `(...${payment.giftCard.code.slice(-4)})`}
                            </span>
                          ) : (
                            payment.method
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.order?.employee?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {!isRefund && payment.order?.status === 'Closed' && (
                            <button
                              onClick={() => handleRefundClick(payment)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Refund
                            </button>
                          )}
                          {payment.order?.status === 'Refunded' && !isRefund && (
                            <span className="text-gray-400 italic">Refunded</span>
                          )}
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

      {showRefundModal && selectedPayment && (
        <RefundModal
          payment={selectedPayment}
          onClose={() => {
            setShowRefundModal(false);
            setSelectedPayment(null);
          }}
          onSuccess={loadPayments}
        />
      )}
    </div>
  );
}

function RefundModal({ payment, onClose, onSuccess }: { payment: any; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(Math.abs(parseFloat(payment.amount)).toString());
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const maxAmount = Math.abs(parseFloat(payment.amount));

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parseFloat(amount) > maxAmount) {
      toast.error('Refund amount cannot exceed original payment');
      return;
    }

    try {
      setProcessing(true);
      await api.post('/payments/refund', {
        orderId: payment.orderId,
        amount: parseFloat(amount),
        reason,
      });
      toast.success('Refund processed successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Refund failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Process Refund</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRefund} className="p-6 space-y-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-800 font-medium">
              Warning: This action will mark Order #{payment.orderId} as refunded and cannot be undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refund Amount (€)
            </label>
            <input
              type="number"
              step="0.01"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Original payment: €{maxAmount.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g., Customer return, accidental charge..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}