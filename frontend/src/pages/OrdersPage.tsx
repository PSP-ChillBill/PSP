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
  const [tableOrArea, setTableOrArea] = useState('');
  const [reservationId, setReservationId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [businessInfo, setBusinessInfo] = useState<any | null>(null);
  const [selectedLines, setSelectedLines] = useState<any[]>([]);
  const [newItemId, setNewItemId] = useState<string>('');
  const [newOptionId, setNewOptionId] = useState<string>('');
  const [newQty, setNewQty] = useState<string>('1');
  const [taxRates, setTaxRates] = useState<Record<string, number>>({});

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
    setTableOrArea('');
    setReservationId('');
    setSelectedLines([]);
    setNewItemId('');
    setNewOptionId('');
    setNewQty('1');

    try {
      // fetch catalog items and business info for tax calculation
      const [itemsRes, businessRes] = await Promise.all([
        api.get('/catalog/items', { params: { businessId: user?.businessId, status: 'Active' } }),
        api.get(`/businesses/${user?.businessId}`),
      ]);

      let items = itemsRes.data || [];
      const biz = businessRes.data || null;

      // fallback: try without status filter if nothing returned
      if ((!items || items.length === 0) && user?.businessId) {
        try {
          const fallback = await api.get('/catalog/items', { params: { businessId: user.businessId } });
          items = fallback.data || [];
        } catch (e) {
          // ignore here, will handle below
        }
      }

      setCatalogItems(items);
      setBusinessInfo(biz);

      if (!items || items.length === 0) {
        toast('No catalog items available for this business', { icon: 'ℹ️' });
      }

      // fetch tax rates for unique tax classes
      const taxClasses = Array.from(new Set(items.map((i: any) => i.taxClass).filter(Boolean)));
      const rates: Record<string, number> = {};
      await Promise.all(taxClasses.map(async (tc: string) => {
        try {
          const r = await api.get('/taxes/current', { params: { countryCode: biz?.countryCode, taxClass: tc } });
          rates[tc] = parseFloat(r.data.ratePercent || r.data.rate || 0);
        } catch (e) {
          rates[tc] = 0;
        }
      }));
      setTaxRates(rates);
    } catch (err: any) {
      console.error('Error loading catalog/business:', err?.response || err);
      toast.error(err?.response?.data?.message || 'Failed to load catalog or business info');
    }

    setShowNewOrder(true);
  };

  const submitNewOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.businessId) {
      toast.error('Missing business context');
      return;
    }

    setCreating(true);
    try {
      const payload: any = { businessId: user.businessId };
      if (tableOrArea.trim()) payload.tableOrArea = tableOrArea.trim();
      if (reservationId.trim()) payload.reservationId = parseInt(reservationId, 10);

      const response = await api.post('/orders', payload);
      const orderId = response.data.id;

      // create order lines
      try {
        await Promise.all(selectedLines.map((ln) => {
          const payload: any = { qty: String(ln.qty) };
          if (ln.optionId) payload.optionId = ln.optionId;
          else if (ln.catalogItemId) payload.catalogItemId = ln.catalogItemId;
          return api.post(`/orders/${orderId}/lines`, payload);
        }));
      } catch (e: any) {
        console.error('Error creating order lines:', e?.response || e);
        toast.error(e?.response?.data?.message || 'Order created but failed to add some items');
      }

      cart.setOrderId(orderId);
      setShowNewOrder(false);
      toast.success('New order created');
      loadOrders();
    } catch (err: any) {
      // Try show validation message from backend if available
      const msg = err?.response?.data?.message || err?.message || 'Failed to create order';
      toast.error(msg);
    } finally {
      setCreating(false);
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

      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={submitNewOrder}
            className="w-full max-w-2xl bg-white rounded-lg shadow p-6 m-4"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-xl font-semibold mb-4">Create New Order</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm text-gray-600">Table / Area (optional)</label>
                <input
                  value={tableOrArea}
                  onChange={(e) => setTableOrArea(e.target.value)}
                  className="w-full mb-4 px-3 py-2 border rounded-lg"
                  placeholder="Table 5, Patio, etc."
                />

                <label className="block mb-2 text-sm text-gray-600">Reservation ID (optional)</label>
                <input
                  value={reservationId}
                  onChange={(e) => setReservationId(e.target.value)}
                  className="w-full mb-4 px-3 py-2 border rounded-lg"
                  placeholder="123"
                  inputMode="numeric"
                />

                <div className="mb-4">
                  <label className="block mb-2 text-sm text-gray-600">Select item</label>
                  <select
                    value={newItemId}
                    onChange={(e) => {
                      setNewItemId(e.target.value);
                      setNewOptionId('');
                    }}
                    className="w-full px-3 py-2 border rounded-lg mb-2"
                  >
                    <option value="">-- choose an item --</option>
                    {catalogItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} — €{parseFloat(it.basePrice).toFixed(2)}
                      </option>
                    ))}
                  </select>

                  {newItemId && (() => {
                    const item = catalogItems.find((c) => String(c.id) === newItemId);
                    const opts = item?.options || [];
                    if (!opts || opts.length === 0) return null;
                    return (
                      <div className="mb-2">
                        <label className="block mb-1 text-sm text-gray-600">Option</label>
                        <select
                          value={newOptionId}
                          onChange={(e) => setNewOptionId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="">-- choose an option --</option>
                          {opts.map((opt: any) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name} {opt.priceModifier ? `(+€${parseFloat(opt.priceModifier).toFixed(2)})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}

                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-24 px-3 py-2 border rounded-lg"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const item = catalogItems.find((c) => String(c.id) === newItemId);
                        if (!item) {
                          toast.error('Please select an item');
                          return;
                        }
                        const opts = item.options || [];
                        const itemHasOptions = opts.length > 0;
                        const option = opts.find((o: any) => String(o.id) === newOptionId);
                        if (itemHasOptions && !option) {
                          toast.error('Please select an option');
                          return;
                        }
                        const qtyNum = parseInt(newQty || '1', 10) || 1;
                        if (qtyNum <= 0) {
                          toast.error('Quantity must be at least 1');
                          return;
                        }
                        const unit = parseFloat(item.basePrice) + parseFloat((option?.priceModifier ?? 0) as any || 0);
                        setSelectedLines((s) => [...s, {
                          catalogItemId: item.id,
                          optionId: option?.id ?? null,
                          qty: qtyNum,
                          itemName: item.name,
                          optionName: option?.name ?? '',
                          unitPrice: unit,
                          taxClass: item.taxClass,
                        }]);

                        // reset selects to default values so user can add another item
                        setNewItemId('');
                        setNewOptionId('');
                        setNewQty('1');
                      }}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg"
                      disabled={!newItemId || (catalogItems.find((c) => String(c.id) === newItemId)?.options?.length > 0 && !newOptionId)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm text-gray-600">Selected items</label>
                <div className="max-h-56 overflow-auto border rounded-lg p-2 bg-gray-50">
                  {selectedLines.length === 0 && <p className="text-sm text-gray-500">No items added</p>}
                  {selectedLines.map((ln, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm font-medium">{ln.itemName} {ln.optionName && `(${ln.optionName})`}</div>
                        <div className="text-xs text-gray-500">€{ln.unitPrice.toFixed(2)} × {ln.qty}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={String(ln.qty)}
                          onChange={(e) => {
                            const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                            setSelectedLines((s) => s.map((it, i) => i === idx ? { ...it, qty: v } : it));
                          }}
                          className="w-16 px-2 py-1 border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedLines((s) => s.filter((_, i) => i !== idx))}
                          className="px-2 py-1 text-sm rounded border"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>€{selectedLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estimated Tax</span>
                    <span>€{(() => {
                      // estimate tax using cached taxRates; fallback 0
                      return selectedLines.reduce((sum, l) => {
                        const rate = taxRates[l.taxClass] ?? 0;
                        return sum + (l.unitPrice * l.qty) * (rate / 100);
                      }, 0).toFixed(2);
                    })()}</span>
                  </div>
                  <div className="flex justify-between font-semibold mt-2">
                    <span>Total (est.)</span>
                    <span>€{(() => {
                      const sub = selectedLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
                      const tax = selectedLines.reduce((sum, l) => sum + (l.unitPrice * l.qty) * ((taxRates[l.taxClass] ?? 0) / 100), 0);
                      return (sub + tax).toFixed(2);
                    })()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowNewOrder(false)}
                className="px-4 py-2 rounded-lg border"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white"
                disabled={creating || selectedLines.length === 0}
              >
                {creating ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      )}

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
