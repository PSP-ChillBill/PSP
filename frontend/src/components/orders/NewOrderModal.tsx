import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { X, Plus, Minus, Trash2 } from 'lucide-react';

export default function NewOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ itemId: number; name: string; price: number; qty: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const [taxRates, setTaxRates] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadCatalog();
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const res = await api.get('/seats', { params: { businessId: user?.businessId } });
      setTables(res.data);
    } catch {
      // non-critical
    }
  };

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const response = await api.get('/catalog/items', {
        params: { businessId: user?.businessId, status: 'Active' },
      });
      
      const items = response.data;
      setCatalogItems(items);
      
      // Fetch tax rates for each unique tax class
      const taxClasses = [...new Set(items.map((item: any) => item.taxClass))] as string[];
      const rates: { [key: string]: number } = {};
      
      for (const taxClass of taxClasses) {
        try {
          const taxRes = await api.get('/taxes/current', {
            params: { 
              countryCode: user?.business?.countryCode,
              taxClass 
            },
          });
          rates[taxClass as string] = parseFloat(taxRes.data.ratePercent);
        } catch {
          rates[taxClass as string] = 0;
        }
      }
      
      setTaxRates(rates);
    } catch (error) {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const getPriceWithTax = (item: any): number => {
    const basePrice = parseFloat(item.basePrice);
    const taxRate = taxRates[item.taxClass] || 0;
    return basePrice * (1 + taxRate / 100);
  };

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      setCart(cart.map(c => c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, {
        itemId: item.id,
        name: item.name,
        price: getPriceWithTax(item),
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
      const tableName = tables.find(t => t.id === selectedTable)?.name;
      const orderRes = await api.post('/orders', {
        businessId: user?.businessId,
        tableOrArea: tableName || undefined,
      });
      const orderId = orderRes.data.id;

      // Add lines (need to get options first)
      for (const item of cart) {
        const catalogItem = catalogItems.find(c => c.id === item.itemId);
        let optionId = catalogItem?.options?.[0]?.id;

        if (!optionId) {
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Table (Optional)</label>
            <select
              className="w-full max-w-sm px-3 py-2 border rounded"
              value={selectedTable ?? ''}
              onChange={(e) => setSelectedTable(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">No Table</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Cap: {t.capacity})
                </option>
              ))}
            </select>
          </div>
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
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-lg font-semibold text-primary-600">
                          €{getPriceWithTax(item).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          (incl. tax)
                        </div>
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
