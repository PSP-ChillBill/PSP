import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { X, Plus, Minus, Trash2 } from 'lucide-react';

export default function EditOrderModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderLines, setOrderLines] = useState(order.orderLines || []);
  const [saving, setSaving] = useState(false);
  const [taxRates, setTaxRates] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const response = await api.get('/catalog/items', {
        params: { businessId: user?.businessId, status: 'Active' },
      });
      
      const items = response.data;
      setCatalogItems(items);
      
      // Fetch tax rates for each unique tax class
      const taxClasses = [...new Set(items.map((item: any) => item.taxClass))];
      const rates: { [key: string]: number } = {};
      
      for (const taxClass of taxClasses) {
        try {
          const taxRes = await api.get('/taxes/current', {
            params: { 
              countryCode: user?.business?.countryCode,
              taxClass 
            },
          });
          rates[taxClass] = parseFloat(taxRes.data.ratePercent);
        } catch {
          rates[taxClass] = 0;
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

  const addItem = (item: any) => {
    const existing = orderLines.find(line => line.option?.catalogItem?.id === item.id);
    if (existing) {
      updateLineQty(existing.id, parseFloat(existing.qty) + 1);
    } else {
      // Need to get or create an option first
      const defaultOption = item.options?.[0];
      if (defaultOption) {
        addLineToOrder(defaultOption.id, 1);
      }
    }
  };

  const addLineToOrder = async (optionId: number, qty: number) => {
    try {
      const response = await api.post(`/orders/${order.id}/lines`, {
        optionId,
        qty,
      });
      setOrderLines([...orderLines, { ...response.data, option: { catalogItem: catalogItems.find(c => c.id === optionId) } }]);
      toast.success('Item added');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to add item');
    }
  };

  const updateLineQty = async (lineId: number, newQty: number) => {
    if (newQty <= 0) {
      removeLineFromOrder(lineId);
      return;
    }

    try {
      await api.put(`/orders/${order.id}/lines/${lineId}`, {
        qty: newQty,
      });
      setOrderLines(orderLines.map(line => 
        line.id === lineId ? { ...line, qty: newQty } : line
      ));
      toast.success('Item quantity updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update item');
    }
  };

  const removeLineFromOrder = async (lineId: number) => {
    try {
      await api.delete(`/orders/${order.id}/lines/${lineId}`);
      setOrderLines(orderLines.filter(line => line.id !== lineId));
      toast.success('Item removed');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to remove item');
    }
  };

  const getCartTotal = () => {
    return orderLines.reduce((sum, line) => {
      const lineTotal = parseFloat(line.unitPriceSnapshot) * parseFloat(line.qty);
      const tax = lineTotal * (parseFloat(line.taxRateSnapshotPct) / 100);
      return sum + lineTotal + tax;
    }, 0);
  };

  const handleClose = async () => {
    setSaving(true);
    try {
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit Order #{order.id}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h3 className="font-medium text-gray-900 mb-3">Available Items</h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catalogItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
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
                {orderLines.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No items in order</p>
                ) : (
                  <>
                    {orderLines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between bg-white p-3 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{line.itemNameSnapshot}</div>
                          {line.optionNameSnapshot && <div className="text-xs text-gray-500">{line.optionNameSnapshot}</div>}
                          <div className="text-xs text-gray-500">€{parseFloat(line.unitPriceSnapshot).toFixed(2)} each</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateLineQty(line.id, parseFloat(line.qty) - 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{parseFloat(line.qty).toFixed(0)}</span>
                          <button
                            onClick={() => updateLineQty(line.id, parseFloat(line.qty) + 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeLineFromOrder(line.id)}
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
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
