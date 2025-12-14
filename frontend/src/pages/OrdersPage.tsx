import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, ShoppingCart } from 'lucide-react';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const cart = useCartStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders', {
        params: { businessId: user?.businessId, status: 'Open' },
      });
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const response = await api.post('/orders', {
        businessId: user?.businessId,
      });
      cart.setOrderId(response.data.id);
      setShowNewOrder(true);
      toast.success('New order created');
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <button
          onClick={handleCreateOrder}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>New Order</span>
        </button>
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
              <p className="text-gray-500">No open orders</p>
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
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {order.status}
                  </span>
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
                </div>

                <div className="mt-4 flex space-x-2">
                  <button className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                    Process Payment
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function calculateOrderTotal(order: any): number {
  if (!order.orderLines) return 0;
  return order.orderLines.reduce((sum: number, line: any) => {
    const lineTotal = parseFloat(line.unitPriceSnapshot) * parseFloat(line.qty);
    const tax = lineTotal * (parseFloat(line.taxRateSnapshotPct) / 100);
    return sum + lineTotal + tax;
  }, 0);
}
