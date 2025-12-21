import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  History, 
  RefreshCw, 
  Plus, 
  AlertTriangle, 
  X,
  ArrowRightLeft
} from 'lucide-react';
import { format } from 'date-fns';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadInventory();
  }, [user?.businessId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory/items', {
        params: { businessId: user?.businessId },
      });
      setStockItems(response.data);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const openAdjust = (item: any) => {
    setSelectedItem(item);
    setShowAdjustModal(true);
  };

  const openHistory = (item: any) => {
    setSelectedItem(item);
    setShowHistoryModal(true);
  };

  const getStockStatus = (qty: number) => {
    if (qty <= 0) return { color: 'bg-red-100 text-red-800', label: 'Out of Stock' };
    if (qty < 10) return { color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' };
    return { color: 'bg-green-100 text-green-800', label: 'In Stock' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrackModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Track Item</span>
          </button>
          <button 
            onClick={loadInventory}
            className="p-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100 transition"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inventory items found</p>
                  </td>
                </tr>
              ) : (
                stockItems.map((item) => {
                  const qty = parseFloat(item.qtyOnHand);
                  const status = getStockStatus(qty);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.catalogItem.name}</div>
                          <div className="text-sm text-gray-500">{item.catalogItem.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.catalogItem.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                           <span className={`text-sm font-medium ${qty <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                             {qty.toFixed(2)} {item.unit}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        €{parseFloat(item.averageUnitCost).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openHistory(item)}
                          className="text-gray-400 hover:text-primary-600 mr-3"
                          title="View History"
                        >
                          <History className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openAdjust(item)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Adjust Stock"
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showTrackModal && (
        <TrackStockModal
          onClose={() => setShowTrackModal(false)}
          onSuccess={loadInventory}
        />
      )}

      {showAdjustModal && selectedItem && (
        <AdjustStockModal
          item={selectedItem}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedItem(null);
          }}
          onSuccess={loadInventory}
        />
      )}

      {showHistoryModal && selectedItem && (
        <StockHistoryModal
          item={selectedItem}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

function TrackStockModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | string>('');
  const [unit, setUnit] = useState('pcs');
  const [qty, setQty] = useState('0');
  const [cost, setCost] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      const res = await api.get('/catalog/items', { 
        params: { businessId: user?.businessId, type: 'Product' } 
      });
      // Filter out items that already have stockItem
      const untracked = res.data.filter((i: any) => !i.stockItem);
      setItems(untracked);
    } catch (e) {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error('Select an item');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/inventory/items', {
        catalogItemId: Number(selectedItemId),
        unit,
        qtyOnHand: parseFloat(qty),
        averageUnitCost: parseFloat(cost)
      });
      toast.success('Tracking enabled for item');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to track item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Track New Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {loading ? (
             <div className="flex justify-center py-4">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
             </div>
          ) : items.length === 0 ? (
             <div className="text-center py-4 text-gray-500">
               All product items are already being tracked.
             </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catalog Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="" disabled>Select an item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                  placeholder="e.g. pcs, kg, L"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avg Cost (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
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
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Start Tracking'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function AdjustStockModal({ item, onClose, onSuccess }: { item: any; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<'Receive' | 'Waste' | 'Adjust'>('Receive');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(parseFloat(item.averageUnitCost).toFixed(2));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    try {
      setSubmitting(true);
      // For Waste, delta is negative. For Receive, positive. 
      // Adjust assumes manual delta (here we treat positive as addition if user selected Adjust, but typically implies correction)
      const payload = {
        stockItemId: item.id,
        type,
        delta: type === 'Waste' ? -Math.abs(parseFloat(quantity)) : parseFloat(quantity),
        unitCostSnapshot: parseFloat(unitCost),
        notes,
      };

      await api.post('/inventory/movements', payload);
      toast.success('Stock updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Adjust Stock</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">Item: <span className="font-medium text-gray-900">{item.catalogItem.name}</span></p>
            <p className="text-sm text-gray-500">Current Stock: <span className="font-medium text-gray-900">{parseFloat(item.qtyOnHand).toFixed(2)} {item.unit}</span></p>
          </div>

          <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
            {(['Receive', 'Waste', 'Adjust'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                  type === t
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity {type === 'Waste' ? '(to remove)' : type === 'Receive' ? '(to add)' : '(delta)'}
            </label>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {type === 'Receive' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Cost (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockHistoryModal({ item, onClose }: { item: any; onClose: () => void }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [item.id]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventory/movements', {
        params: { stockItemId: item.id },
      });
      setMovements(response.data);
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stock History</h2>
            <p className="text-sm text-gray-500">{item.catalogItem.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : movements.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No movements found</p>
          ) : (
            <div className="space-y-4">
              {movements.map((move) => {
                const isPositive = parseFloat(move.delta) > 0;
                return (
                  <div key={move.id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${
                        move.type === 'Receive' ? 'bg-green-100 text-green-700' :
                        move.type === 'Waste' ? 'bg-red-100 text-red-700' :
                        move.type === 'Sale' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {move.type === 'Receive' ? <Plus className="w-4 h-4" /> :
                         move.type === 'Waste' ? <AlertTriangle className="w-4 h-4" /> :
                         move.type === 'Sale' ? <TrendingDown className="w-4 h-4" /> :
                         <ArrowRightLeft className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{move.type}</p>
                        <p className="text-xs text-gray-500">{format(new Date(move.createdAt), 'PP p')}</p>
                        {move.notes && <p className="text-xs text-gray-600 mt-1">{move.notes}</p>}
                        {move.orderLine && (
                           <p className="text-xs text-gray-500 mt-1">Order #{move.orderLine.orderId}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{parseFloat(move.delta).toFixed(3)}
                      </p>
                      <p className="text-xs text-gray-500">@ €{parseFloat(move.unitCostSnapshot).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}