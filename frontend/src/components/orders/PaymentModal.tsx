import { useEffect, useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { CreditCard, Gift, History, X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CURRENCY_SYMBOLS } from '../../lib/currencies';
import { calculateOrderTotal } from '../../lib/order';

export default function PaymentModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'CardCredit' | 'GiftCard'>('Cash');
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({ 'EUR': 1.0 });
  const [clientSecret, setClientSecret] = useState<string>('');
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [selectedGiftCard, setSelectedGiftCard] = useState<number | null>(null);
  const [giftCardSearch, setGiftCardSearch] = useState('');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [amountToPay, setAmountToPay] = useState('');
  const [currentOrder, setCurrentOrder] = useState(order);
  const [tipInput, setTipInput] = useState<string>(
    (order?.tipAmount ? parseFloat(order.tipAmount).toFixed(2) : '')
  );
  const [applyingTip, setApplyingTip] = useState(false);
  
  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const { subtotal: baseSubtotal, tax: baseTaxAmount, total: baseOrderTotal } = calculateOrderTotal(currentOrder);
  const exchangeRate = exchangeRates[selectedCurrency] || 1.0;
  
  // Totals with discount
  const discountAmount = currentOrder.discountAmount || 0;
  const netOrderTotal = Math.max(0, baseOrderTotal - discountAmount);
  const appliedDiscount = currentOrder.discount || null;
  const tipAmount = currentOrder.tipAmount ? parseFloat(currentOrder.tipAmount) : 0;
  
  const totalPaidBase = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const remainingBase = Math.max(0, netOrderTotal + tipAmount - totalPaidBase);
  const remainingInCurrency = parseFloat((remainingBase * exchangeRate).toFixed(2));
  
  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency;

  useEffect(() => {
    loadExchangeRates();
    loadExistingPayments();
  }, []);

  // Update amount input when changes occur
  useEffect(() => {
    setAmountToPay(remainingInCurrency.toFixed(2));
  }, [existingPayments, selectedCurrency, exchangeRates, discountAmount, tipAmount, baseOrderTotal]);

  useEffect(() => {
    // Reset discount UI when modal closes
    return () => {
      setShowDiscountInput(false);
      setDiscountCodeInput('');
    };
  }, []);

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
      const res = await api.get(`/payments/order/${order.id}`);
      setExistingPayments(res.data);
    } catch (error) {
      toast.error('Failed to load payment history');
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

  const applyDiscount = async () => {
    if (!discountCodeInput.trim()) {
      toast.error('Please enter a discount code');
      return;
    }

    try {
      setApplyingDiscount(true);
      const res = await api.post(`/orders/${currentOrder.id}/apply-discount`, {
        discountCode: discountCodeInput.trim(),
      });
      const updatedOrder = res.data;
      setCurrentOrder(updatedOrder);
      setShowDiscountInput(false);
      setDiscountCodeInput('');
      toast.success(`Discount "${discountCodeInput}" applied!`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to apply discount');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const removeDiscount = async () => {
    try {
      setApplyingDiscount(true);
      const res = await api.delete(`/orders/${currentOrder.id}/discount`);
      const updatedOrder = res.data;
      setCurrentOrder(updatedOrder);
      toast.success('Discount removed');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to remove discount');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const applyTip = async () => {
    const val = parseFloat(tipInput || '0');
    if (isNaN(val) || val < 0) {
      toast.error('Invalid tip amount');
      return;
    }
    try {
      setApplyingTip(true);
      const res = await api.put(`/orders/${currentOrder.id}/tip`, { amount: val });
      setCurrentOrder(res.data);
      toast.success('Tip updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update tip');
    } finally {
      setApplyingTip(false);
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
    const total = netOrderTotal + tipAmount;
    
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
          card: { token: 'tok_visa' },
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
          currency: 'EUR',
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
          <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                  {/* Tip Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Tip</h3>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={tipInput}
                        onChange={(e) => setTipInput(e.target.value)}
                        placeholder="e.g., 5.00"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={applyTip}
                        disabled={applyingTip}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      >
                        {applyingTip ? 'Applying...' : 'Apply Tip'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[5, 10, 12.5, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            const calc = (netOrderTotal * pct) / 100;
                            const amount = parseFloat(calc.toFixed(2));
                            setTipInput(amount.toFixed(2));
                            (async () => {
                              try {
                                setApplyingTip(true);
                                const res = await api.put(`/orders/${currentOrder.id}/tip`, { amount });
                                setCurrentOrder(res.data);
                                toast.success(`Tip set to ${pct}%`);
                              } catch (error: any) {
                                toast.error(error?.response?.data?.message || 'Failed to update tip');
                              } finally {
                                setApplyingTip(false);
                              }
                            })();
                          }}
                          className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Tip is added to the order total and paid along with the bill.</p>
                  </div>

                  {/* Discount Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Discount Code</h3>
                      <button
                        type="button"
                        onClick={() => setShowDiscountInput(!showDiscountInput)}
                        className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                      >
                        {showDiscountInput ? 'Hide' : 'Apply Discount'}
                      </button>
                    </div>
                    {appliedDiscount && (
                      <div className="mt-2 text-sm text-green-700 bg-green-50 p-2 rounded flex items-center justify-between">
                        <span>
                          Discount: {appliedDiscount.code}
                          {appliedDiscount.type === 'Percent' ? ` -${appliedDiscount.value}%` : ` -€${appliedDiscount.value}`}
                        </span>
                        <button
                          type="button"
                          onClick={removeDiscount}
                          disabled={applyingDiscount}
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {showDiscountInput && (
                      <div className="mt-3">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={discountCodeInput}
                            onChange={(e) => setDiscountCodeInput(e.target.value)}
                            placeholder="Enter discount code"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                applyDiscount();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={applyDiscount}
                            disabled={applyingDiscount}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                          >
                            {applyingDiscount ? 'Applying...' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Currency Selection */}
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
                <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Order #{currentOrder.id}</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">€{baseSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxes</span>
                  <span className="font-medium">€{baseTaxAmount.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>- €{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium pt-1 border-t">
                  <span className="text-gray-900">Total</span>
                  <span>€{netOrderTotal.toFixed(2)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tip</span>
                    <span className="font-medium">€{tipAmount.toFixed(2)}</span>
                  </div>
                )}
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
