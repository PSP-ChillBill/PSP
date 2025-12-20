import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, ShoppingCart, X, Minus, CreditCard, Gift, Trash2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CURRENCY_SYMBOLS } from '../lib/currencies';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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

  const handleOpenNewOrder = () => {
    setShowNewOrderModal(true);
  };

  const handleOpenPayment = (order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
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
                  <button
                    onClick={() => handleOpenPayment(order)}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Process Payment
                  </button>
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
  
  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const baseOrderTotal = calculateOrderTotal(order);
  const exchangeRate = exchangeRates[selectedCurrency] || 1.0;
  const orderTotal = parseFloat((baseOrderTotal * exchangeRate).toFixed(2));
  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency;

  useEffect(() => {
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    try {
      const res = await api.get('/payments/exchange-rates');
      setExchangeRates(res.data.rates);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not get the exchange rates';
      toast.error(message);
    }
  };

  const searchGiftCards = (query: string) => {
    if (!query.trim()) return giftCards;

    const searchTerm = query.toLowerCase().trim();
    
    // Score each gift card based on how well it matches the search term
    const scoredCards = giftCards.map((gc) => {
      const code = gc.code.toLowerCase();
      let score = 0;

      // Exact match: highest priority
      if (code === searchTerm) {
        score = 1000;
      }
      // Starts with search term
      else if (code.startsWith(searchTerm)) {
        score = 500;
      }
      // Contains search term as complete substring
      else if (code.includes(searchTerm)) {
        score = 300;
      }
      // Levenshtein distance for typo tolerance
      else {
        const distance = levenshteinDistance(code, searchTerm);
        // Give points based on how close (lower distance = higher score)
        if (distance <= 3) {
          score = Math.max(0, 100 - distance * 20);
        }
      }

      return { ...gc, score };
    });

    // Filter out zero-score results and sort by score descending
    return scoredCards
      .filter((gc) => gc.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  const filteredGiftCards = searchGiftCards(giftCardSearch);

  useEffect(() => {
    if (paymentMethod === 'CardCredit') {
      createPaymentIntent();
    } else if (paymentMethod === 'GiftCard') {
      loadGiftCards();
      setGiftCardSearch('');
    }
  }, [paymentMethod]);

  const createPaymentIntent = async () => {
    try {
      const res = await api.post('/payments/create-intent', {
        orderId: order.id,
        amount: orderTotal,
        currency: selectedCurrency.toLowerCase(),
      });
      setClientSecret(res.data.clientSecret);
    } catch (error) {
      toast.error('Failed to initialize payment');
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

    if (paymentMethod === 'Cash') {
      await processCashPayment();
    } else if (paymentMethod === 'CardCredit') {
      await processCardPayment();
    } else if (paymentMethod === 'GiftCard') {
      await processGiftCardPayment();
    }
  };

  const processCashPayment = async () => {
    try {
      setProcessing(true);
      await api.post('/payments', {
        orderId: order.id,
        amount: orderTotal,
        method: 'Cash',
        currency: selectedCurrency,
      });

      await api.post(`/orders/${order.id}/close`);
      toast.success('Payment processed');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const processCardPayment = async () => {
    if (!clientSecret || !cardNumber || !cardExpiry || !cardCvc) {
      toast.error('Please fill in all card details');
      return;
    }

    try {
      setProcessing(true);
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      if (!stripe) {
        toast.error('Payment system not available');
        return;
      }

      // Parse expiry (MM/YY format)
      const parts = cardExpiry.split('/');
      const expMonth = parseInt(parts[0].trim());
      let expYear = parseInt(parts[1].trim());

      // Handle 2-digit year (convert YY to YYYY)
      if (expYear < 100) {
        expYear = 2000 + expYear;
      }

      console.log('Card Details:', {
        number: cardNumber.slice(-4).padStart(16, '*'),
        exp_month: expMonth,
        exp_year: expYear,
        cvc: '***',
      });

      // Use confirmCardPayment with token parameter for raw card data
      const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: {
            token: 'tok_visa', // For testing - in production, use Stripe Elements
          },
        },
      });

      console.log('Stripe Response:', { error, status: paymentIntent?.status });

      if (error) {
        console.error('Stripe Error:', error);
        toast.error(error.message || 'Card declined');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        await api.post('/payments', {
          orderId: order.id,
          amount: orderTotal,
          method: 'CardCredit',
          currency: 'EUR',
          stripePaymentIntentId: paymentIntent.id,
        });

        await api.post(`/orders/${order.id}/close`);
        toast.success('Payment successful');
        onSuccess();
        onClose();
      } else {
        toast.error(`Payment not completed. Status: ${paymentIntent?.status}`);
      }
    } catch (error: any) {
      console.error('Payment Error:', error);
      toast.error(error?.response?.data?.message || error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const processGiftCardPayment = async () => {
    if (!selectedGiftCard) {
      toast.error('Please select a gift card');
      return;
    }

    const giftCard = giftCards.find((gc: any) => gc.id === selectedGiftCard);
    if (!giftCard) {
      toast.error('Gift card not found');
      return;
    }

    const balance = parseFloat(giftCard.balance);
    if (balance < orderTotal) {
      toast.error(`Insufficient gift card balance. Balance: €${balance.toFixed(2)}, Required: €${orderTotal.toFixed(2)}`);
      return;
    }

    try {
      setProcessing(true);
      await api.post('/payments', {
        orderId: order.id,
        amount: orderTotal,
        method: 'GiftCard',
        currency: selectedCurrency,
        giftCardId: selectedGiftCard,
      });

      await api.post(`/orders/${order.id}/close`);
      toast.success('Payment processed with gift card');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Process Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePayment} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Order #{order.id}</div>
            <div className="text-2xl font-bold text-gray-900">{currencySymbol}{orderTotal.toFixed(2)}</div>
            {selectedCurrency !== 'EUR' && (
              <div className="text-xs text-gray-500 mt-1">≈ €{baseOrderTotal.toFixed(2)} EUR</div>
            )}
          </div>

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

              <p className="text-xs text-gray-500 mt-2">
                Test card: 4242 4242 4242 4242 | Exp: 12/34 | CVC: 123
              </p>
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
              disabled={processing || (paymentMethod === 'CardCredit' && !clientSecret)}
              className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : `Pay ${currencySymbol}${orderTotal.toFixed(2)}`}
            </button>
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

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
