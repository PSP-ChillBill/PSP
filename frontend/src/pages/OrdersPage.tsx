import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, ShoppingCart, CreditCard, RotateCcw, Printer } from 'lucide-react';
import PaymentModal from '../components/orders/PaymentModal';
import RefundModal from '../components/orders/RefundModal';
import NewOrderModal from '../components/orders/NewOrderModal';
import { calculateOrderTotal } from '../lib/order';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('Open');

  useEffect(() => {
    loadOrders();
  }, [filterStatus]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: any = { businessId: user?.businessId };
      if (filterStatus !== 'All') {
        params.status = filterStatus;
      }
      
      const response = await api.get('/orders', { params });
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewOrder = () => {
    setShowNewOrderModal(true);
  };

  const handleOpenPayment = (order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const handleOpenRefund = (order: any) => {
    setSelectedOrder(order);
    setShowRefundModal(true);
  };

  const handlePrintReceipt = async (orderId: number) => {
    try {
      const response = await api.get(`/orders/${orderId}/receipt`, {
        responseType: 'text',
      });
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(response.data);
        printWindow.document.close();
        // The onload="window.print()" in HTML will trigger print dialog
      } else {
        toast.error('Please allow popups to print receipt');
      }
    } catch (error) {
      toast.error('Failed to generate receipt');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <button
          onClick={handleOpenNewOrder}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>New Order</span>
        </button>
      </div>

      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {['Open', 'Closed', 'Refunded', 'All'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filterStatus === status
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {status === 'All' ? 'All Orders' : status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-white rounded-lg shadow">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No {filterStatus !== 'All' ? filterStatus.toLowerCase() : ''} orders found</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.id}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {order.employee?.name} • {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePrintReceipt(order.id)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                      title="Print Receipt"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'Open'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'Closed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {order.orderLines?.map((line: any) => (
                    <div key={line.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {line.qty}x {line.itemNameSnapshot}
                        {line.optionNameSnapshot && ` (${line.optionNameSnapshot})`}
                      </span>
                      <span className="text-gray-900 font-medium">
                        €{(parseFloat(line.unitPriceSnapshot) * parseFloat(line.qty)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.tableOrArea && (
                  <p className="text-sm text-gray-600 mb-2">Table: {order.tableOrArea}</p>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>€{calculateOrderTotal(order).toFixed(2)}</span>
                  </div>
                  {order.payments && order.payments.length > 0 && order.status === 'Open' && (
                     <div className="flex items-center justify-between text-sm text-green-600 mt-1">
                       <span>Paid so far</span>
                       <span>€{order.payments.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0).toFixed(2)}</span>
                     </div>
                  )}
                </div>

                <div className="mt-4 flex space-x-2">
                  {order.status === 'Open' ? (
                    <button
                      onClick={() => handleOpenPayment(order)}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center justify-center space-x-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Process Payment</span>
                    </button>
                  ) : order.status === 'Closed' ? (
                    <button
                      onClick={() => handleOpenRefund(order)}
                      className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Refund Order</span>
                    </button>
                  ) : (
                    <div className="flex-1 px-4 py-2 bg-gray-50 text-gray-500 rounded-lg text-center text-sm">
                      Refunded
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={loadOrders}
        />
      )}

      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={loadOrders}
        />
      )}

      {showRefundModal && selectedOrder && (
        <RefundModal
          order={selectedOrder}
          onClose={() => {
            setShowRefundModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}