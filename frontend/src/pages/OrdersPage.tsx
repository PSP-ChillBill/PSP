import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, ShoppingCart, X, Minus, CreditCard, Gift, Trash2, RotateCcw, History } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CURRENCY_SYMBOLS } from '../lib/currencies';

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

function RefundModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(calculateOrderTotal(order).toFixed(2));
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const maxAmount = calculateOrderTotal(order);

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parseFloat(amount) > maxAmount) {
      toast.error('Refund amount cannot exceed original order total');
      return;
    }

    try {
      setProcessing(true);
      await api.post('/payments/refund', {
        orderId: order.id,
        amount: parseFloat(amount),
        reason,
      });
      toast.success('Order refunded successfully');
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
          <h2 className="text-lg font-semibold text-gray-900">Refund Order #{order.id}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRefund} className="p-6 space-y-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-800 font-medium">
              Warning: This will refund the payment and restore inventory levels for items in this order.
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
              Order Total: €{maxAmount.toFixed(2)}
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
              placeholder="e.g., Customer return, quality issue..."
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

function NewOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ itemId: number; name: string; price: number; qty: number }[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const response = await api.get('/catalog/items', {
        params: { businessId: user?.businessId, status: 'Active' },
      });
      setCatalogItems(response.data);
    } catch (error) {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      setCart(cart.map(c => c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, {
        itemId: item.id,
        name: item.name,
        price: parseFloat(item.basePrice),
        qty: 1,
      }]);
    }
  };

  const updateQty = (itemId: number, delta: number) => {
    setCart(cart.map(c => {
      if (c.itemId === itemId) {
        const newQty = Math.max(1, c.qty + delta);
        return { ...c, qty: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (itemId: number) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  };

  const handleCreate = async () => {
    if (cart.length === 0) {
      toast.error('Add items to the order');
      return;
    }

    try {
      setCreating(true);
      // Create order
      const orderRes = await api.post('/orders', {
        businessId: user?.businessId,
      });
      const orderId = orderRes.data.id;

      // Add lines (need to get options first)
      for (const item of cart) {
        const catalogItem = catalogItems.find(c => c.id === item.itemId);
        // Get or create default option
        let optionId = catalogItem?.options?.[0]?.id;

        if (!optionId) {
          // Create default option if none exists
          const optRes = await api.post('/catalog/options', {
            catalogItemId: item.itemId,
            name: 'Standard',
            priceModifier: 0,
          });
          optionId = optRes.data.id;
        }

        await api.post(`/orders/${orderId}/lines`, {
          optionId,
          qty: item.qty,
        });
      }

      toast.success('Order created');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Order</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h3 className="font-medium text-gray-900 mb-3">Catalog Items</h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catalogItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="text-left p-4 border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition"
                    >
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.code}</div>
                      <div className="text-lg font-semibold text-primary-600 mt-2">
                        €{parseFloat(item.basePrice).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <h3 className="font-medium text-gray-900 mb-3">Order Items</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No items added</p>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.itemId} className="flex items-center justify-between bg-white p-3 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">€{item.price.toFixed(2)} each</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQty(item.itemId, -1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.itemId, 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.itemId)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total</span>
                        <span>€{getCartTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || cart.length === 0}
            className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'CardCredit' | 'GiftCard'>('Cash');
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({ 'EUR': 1.0 });
  const [clientSecret, setClientSecret] = useState<string>('');
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [selectedGiftCard, setSelectedGiftCard] = useState<number | null>(null);
  const [giftCardSearch, setGiftCardSearch] = useState('');
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [amountToPay, setAmountToPay] = useState('');

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const baseOrderTotal = calculateOrderTotal(order);
  const exchangeRate = exchangeRates[selectedCurrency] || 1.0;
  
  const totalPaidBase = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const remainingBase = Math.max(0, baseOrderTotal - totalPaidBase);
  const remainingInCurrency = parseFloat((remainingBase * exchangeRate).toFixed(2));
  
  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency;

  useEffect(() => {
    loadExchangeRates();
    loadExistingPayments();
  }, []);

  // Update amount input when currency or existing payments change
  useEffect(() => {
    if (existingPayments.length >= 0) {
      setAmountToPay(remainingInCurrency.toFixed(2));
    }
  }, [existingPayments, selectedCurrency, exchangeRates]);

  const loadExchangeRates = async () => {
    try {
      const res = await api.get('/payments/exchange-rates');
      setExchangeRates(res.data.rates);
    } catch (error: any) {
      console.error('Exchange rate error', error);
    }
  };

  const loadExistingPayments = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get(`/payments/order/${order.id}`);
      setExistingPayments(res.data);
    } catch (error) {
      toast.error('Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const searchGiftCards = (query: string) => {
    if (!query.trim()) return giftCards;
    const searchTerm = query.toLowerCase().trim();
    return giftCards
      .filter(gc => gc.code.toLowerCase().includes(searchTerm))
      .sort((a, b) => b.balance - a.balance);
  };

  const filteredGiftCards = searchGiftCards(giftCardSearch);

  useEffect(() => {
    if (paymentMethod === 'CardCredit') {
      if (parseFloat(amountToPay) > 0) createPaymentIntent();
    } else if (paymentMethod === 'GiftCard') {
      loadGiftCards();
      setGiftCardSearch('');
    }
  }, [paymentMethod]);

  const createPaymentIntent = async () => {
    try {
      const res = await api.post('/payments/create-intent', {
        orderId: order.id,
        amount: parseFloat(amountToPay),
        currency: selectedCurrency.toLowerCase(),
      });
      setClientSecret(res.data.clientSecret);
    } catch (error) {
      console.error('Failed to initialize payment intent', error);
    }
  };

  const loadGiftCards = async () => {
    try {
      const res = await api.get('/gift-cards', {
        params: { businessId: order.businessId },
      });
      setGiftCards(res.data.filter((gc: any) => gc.status === 'Active'));
    } catch (error) {
      toast.error('Failed to load gift cards');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const val = parseFloat(amountToPay);
    if (isNaN(val) || val <= 0) {
      toast.error('Invalid amount');
      return;
    }
    
    if (val > remainingInCurrency + 0.05) {
      toast.error(`Amount exceeds remaining balance (€${remainingBase.toFixed(2)})`);
      return;
    }

    if (paymentMethod === 'Cash') {
      await processCashPayment(val);
    } else if (paymentMethod === 'CardCredit') {
      await processCardPayment(val);
    } else if (paymentMethod === 'GiftCard') {
      await processGiftCardPayment(val);
    }
  };

  const checkCloseOrder = async () => {
    const res = await api.get(`/payments/order/${order.id}`);
    const updatedPayments = res.data;
    setExistingPayments(updatedPayments);

    const paid = updatedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    const total = baseOrderTotal;
    
    // If fully paid, close
    if (paid >= total - 0.01) {
      await api.post(`/orders/${order.id}/close`);
      toast.success('Order paid in full and closed');
      onSuccess();
      onClose();
    } else {
      toast.success('Partial payment recorded');
    }
  };

  const processCashPayment = async (amount: number) => {
    try {
      setProcessing(true);
      await api.post('/payments', {
        orderId: order.id,
        amount: amount,
        method: 'Cash',
        currency: selectedCurrency,
      });

      await checkCloseOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const processCardPayment = async (amount: number) => {
    if (!clientSecret || !cardNumber || !cardExpiry || !cardCvc) {
      toast.error('Please fill in all card details');
      return;
    }

    try {
      setProcessing(true);
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      if (!stripe) return;

      const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: { token: 'tok_visa' }, // Test token
        },
      });

      if (error) {
        toast.error(error.message || 'Card declined');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        await api.post('/payments', {
          orderId: order.id,
          amount: amount,
          method: 'CardCredit',
          currency: 'EUR', // Stripe test usually EUR
          stripePaymentIntentId: paymentIntent.id,
        });

        await checkCloseOrder();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const processGiftCardPayment = async (amount: number) => {
    if (!selectedGiftCard) {
      toast.error('Please select a gift card');
      return;
    }

    try {
      setProcessing(true);
      await api.post('/payments', {
        orderId: order.id,
        amount: amount,
        method: 'GiftCard',
        currency: selectedCurrency,
        giftCardId: selectedGiftCard,
      });

      await checkCloseOrder();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Process Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePayment} className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Main Content - Left */}
          <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                  {/* Inputs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={selectedCurrency}
                      onChange={(e) => setSelectedCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Object.keys(exchangeRates).map((currency) => (
                        <option key={currency} value={currency}>
                          {currency} {CURRENCY_SYMBOLS[currency] && ` (${CURRENCY_SYMBOLS[currency]})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Pay ({currencySymbol})</label>
                     <input 
                       type="number"
                       step="0.01"
                       value={amountToPay}
                       onChange={(e) => setAmountToPay(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-semibold"
                     />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="Cash"
                          checked={paymentMethod === 'Cash'}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="text-primary-600"
                        />
                        <span>💵</span>
                        <span>Cash</span>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="CardCredit"
                          checked={paymentMethod === 'CardCredit'}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="text-primary-600"
                        />
                        <CreditCard className="w-5 h-5 text-gray-600" />
                        <span>Credit Card (Stripe Test)</span>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="GiftCard"
                          checked={paymentMethod === 'GiftCard'}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="text-primary-600"
                        />
                        <Gift className="w-5 h-5 text-gray-600" />
                        <span>Gift Card</span>
                      </label>
                    </div>
                  </div>

                  {/* Specific Inputs */}
                  {paymentMethod === 'CardCredit' && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Card Number</label>
                      <input
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        maxLength={19}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (MM/YY)</label>
                          <input
                            type="text"
                            placeholder="12/34"
                            value={cardExpiry}
                            onChange={(e) => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length >= 2) {
                                val = val.slice(0, 2) + '/' + val.slice(2, 4);
                              }
                              setCardExpiry(val);
                            }}
                            maxLength={5}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                          <input
                            type="text"
                            placeholder="123"
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'GiftCard' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Select Gift Card</label>
                      {giftCards.length === 0 ? (
                        <p className="text-sm text-gray-500">No active gift cards available</p>
                      ) : (
                        <>
                          <input
                            type="text"
                            placeholder="Search by gift card code..."
                            value={giftCardSearch}
                            onChange={(e) => setGiftCardSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <select
                            value={selectedGiftCard ?? ''}
                            onChange={(e) => setSelectedGiftCard(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Choose a gift card...</option>
                            {filteredGiftCards.length === 0 ? (
                              <option disabled>No matching gift cards</option>
                            ) : (
                              filteredGiftCards.map((gc) => (
                                <option key={gc.id} value={gc.id}>
                                  {gc.code} - €{parseFloat(gc.balance).toFixed(2)} available
                                </option>
                              ))
                            )}
                          </select>
                        </>
                      )}
                    </div>
                  )}
              </div>

              <div className="flex justify-end space-x-3 pt-8 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing || (paymentMethod === 'CardCredit' && !clientSecret)}
                  className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : `Pay ${currencySymbol}${amountToPay}`}
                </button>
              </div>
          </div>

          <div className="w-full md:w-80 bg-gray-50 border-l border-gray-200 p-6 overflow-y-auto">
             <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6 space-y-3">
                <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Order #{order.id}</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-medium">€{baseOrderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Paid</span>
                  <span>- €{totalPaidBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Remaining</span>
                  <span>€{remainingBase.toFixed(2)}</span>
                </div>
                {selectedCurrency !== 'EUR' && (
                    <div className="text-xs text-gray-500 pt-1">
                        ≈ {currencySymbol}{(remainingBase * exchangeRate).toFixed(2)}
                    </div>
                )}
             </div>

             <div>
               <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                 <History className="w-4 h-4 mr-2"/> Payment History
               </h3>
               {existingPayments.length === 0 ? (
                   <p className="text-sm text-gray-500 italic">No payments yet</p>
               ) : (
                   <div className="space-y-2">
                     {existingPayments.map((p) => (
                       <div key={p.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                         <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">€{parseFloat(p.amount).toFixed(2)}</span>
                            <span className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </div>
                         <div className="text-xs text-gray-600 flex items-center gap-1">
                            {p.method === 'Cash' && <span>💵 Cash</span>}
                            {p.method === 'CardCredit' && <span>💳 Card</span>}
                            {p.method === 'GiftCard' && <span>🎁 Gift Card</span>}
                            {p.currency !== 'EUR' && <span className="text-gray-400 ml-1">({p.currency})</span>}
                         </div>
                       </div>
                     ))}
                   </div>
               )}
             </div>
          </div>
        </form>
      </div>
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