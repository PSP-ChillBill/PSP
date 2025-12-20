import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Tag } from 'lucide-react';

export default function DiscountsPage() {
  const { user } = useAuthStore();
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const resetForm = () => {
    setFormCode('');
    setFormType('Percent');
    setFormScope('Order');
    setFormValue('10');
    setFormStartsAt(new Date().toISOString().slice(0, 10));
    setFormEndsAt('');
    setSelectedCatalogItemId(null);
    setEditingDiscountId(null);
  };

  const createDiscount = async () => {
    // Open modal instead — replaced sequential prompts with a single form modal below.
    resetForm();
    setShowCreateModal(true);
  };

  // Modal form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState('Percent');
  const [formScope, setFormScope] = useState('Order');
  const [formValue, setFormValue] = useState('10');
  const [formStartsAt, setFormStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [formEndsAt, setFormEndsAt] = useState('');
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<number | null>(null);

  const submitCreateDiscount = async () => {
    try {
      if (!formCode.trim()) {
        toast.error('Code is required');
        return;
      }
      if (!(formType === 'Percent' || formType === 'Amount')) {
        toast.error('Type must be Percent or Amount');
        return;
      }
      if (!(formScope === 'Order' || formScope === 'Line')) {
        toast.error('Scope must be Order or Line');
        return;
      }
      const value = parseFloat(formValue);
      if (isNaN(value)) {
        toast.error('Invalid value');
        return;
      }
      if (value <= 0) {
        toast.error('Value must be greater than 0');
        return;
      }
      if (formType === 'Percent' && value > 100) {
        toast.error('Percent discount cannot exceed 100');
        return;
      }
      const startsAt = new Date(formStartsAt);
      if (isNaN(startsAt.getTime())) {
        toast.error('Invalid start date');
        return;
      }
      let endsAtIso: string | undefined = undefined;
      if (formEndsAt && formEndsAt.trim() !== '') {
        const e = new Date(formEndsAt);
        if (isNaN(e.getTime())) {
          toast.error('Invalid end date');
          return;
        }
        if (e < startsAt) {
          toast.error('End date must be after start date');
          return;
        }
        endsAtIso = e.toISOString();
      }

      const payload: any = {
        businessId: user?.businessId,
        code: formCode.trim(),
        type: formType,
        scope: formScope,
        value,
        startsAt: startsAt.toISOString(),
      };
      if (formScope === 'Line') {
        if (!selectedCatalogItemId) {
          toast.error('Please select a catalog item');
          return;
        }
        payload.eligibleItems = [selectedCatalogItemId];
      }
      if (endsAtIso) payload.endsAt = endsAtIso;

      setLoading(true);
      if (editingDiscountId) {
        await api.put(`/discounts/${editingDiscountId}`, payload);
        toast.success('Discount updated');
      } else {
        await api.post('/discounts', payload);
        toast.success('Discount created');
      }
      setShowCreateModal(false);
      resetForm();
      await loadDiscounts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create discount');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (discount: any) => {
    setEditingDiscountId(discount.id);
    setFormCode(discount.code || '');
    setFormType(discount.type || 'Percent');
    setFormScope(discount.scope || 'Order');
    setFormValue(discount.value != null ? String(discount.value) : '10');
    setFormStartsAt(discount.startsAt ? discount.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEndsAt(discount.endsAt ? discount.endsAt.slice(0, 10) : '');
    const firstEligibility = discount.eligibilities && discount.eligibilities[0];
    setSelectedCatalogItemId(firstEligibility ? firstEligibility.catalogItemId : null);
    setShowCreateModal(true);
  };

  const deleteDiscount = async (id: number) => {
    if (!confirm('Delete this discount?')) return;
    try {
      setLoading(true);
      await api.delete(`/discounts/${id}`, { params: { businessId: user?.businessId } });
      toast.success('Discount deleted');
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
      await loadDiscounts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete discount');
    } finally {
      setLoading(false);
    }
  };

  const deactivateDiscount = async (discount: any) => {
    if (discount.status === 'Inactive') {
      toast.success('Already inactive');
      return;
    }
    if (!confirm('Deactivate this discount?')) return;
    await updateDiscountStatus(discount, 'Inactive');
  };

  const activateDiscount = async (discount: any) => {
    if (discount.status === 'Active') {
      toast.success('Already active');
      return;
    }
    if (!confirm('Activate this discount?')) return;
    await updateDiscountStatus(discount, 'Active');
  };

  const updateDiscountStatus = async (discount: any, status: 'Active' | 'Inactive') => {
    try {
      setLoading(true);
      const payload: any = {
        businessId: user?.businessId,
        code: discount.code,
        type: discount.type,
        scope: discount.scope,
        value: discount.value,
        startsAt: discount.startsAt,
        status,
      };
      if (discount.endsAt) payload.endsAt = discount.endsAt;
      await api.put(`/discounts/${discount.id}`, payload);
      toast.success(`Discount ${status === 'Active' ? 'activated' : 'deactivated'}`);
      await loadDiscounts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update discount status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  // Load catalog items when modal opens or scope switches to Line (Catalog Item)
  useEffect(() => {
    const loadCatalogItems = async () => {
      if (!showCreateModal || formScope !== 'Line') return;
      try {
        const res = await api.get('/catalog/items', {
          params: { businessId: user?.businessId },
        });
        setCatalogItems(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load catalog items');
      }
    };
    loadCatalogItems();
  }, [showCreateModal, formScope, user?.businessId]);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/discounts', {
        params: { businessId: user?.businessId },
      });
      setDiscounts(response.data);
    } catch (error) {
      toast.error('Failed to load discounts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Discounts</h1>
        {['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '') && (
          <button
            onClick={createDiscount}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-60"
          >
            <Plus className="w-5 h-5" />
            <span>Create Discount</span>
          </button>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Create Discount</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code</label>
                <input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="mt-1 block w-full border rounded-md px-3 py-2"
                  placeholder="SUMMER10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-3 py-2"
                  >
                    <option>Percent</option>
                    <option>Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-3 py-2"
                  >
                    <option value="Order">Order</option>
                    <option value="Line">Catalog Item</option>
                  </select>
                </div>
              </div>

              {formScope === 'Line' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Catalog Item</label>
                  <select
                    value={selectedCatalogItemId ?? ''}
                    onChange={(e) => setSelectedCatalogItemId(e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 block w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Select item</option>
                    {catalogItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Value</label>
                <input
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="mt-1 block w-full border rounded-md px-3 py-2"
                  placeholder="10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Starts At</label>
                  <input
                    type="date"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ends At (optional)</label>
                  <input
                    type="date"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="mt-1 block w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={submitCreateDiscount}
                className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={loading}
              >
                {editingDiscountId ? 'Confirm' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {discounts.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-white rounded-lg shadow">
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No discounts configured</p>
            </div>
          ) : (
            discounts.map((discount) => (
              <div key={discount.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{discount.code}</h3>
                    <p className="text-sm text-gray-500">{discount.scope} discount</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      discount.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {discount.status}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-2xl font-bold text-primary-600">
                    {discount.type === 'Percent'
                      ? `${discount.value}%`
                      : `€${discount.value}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {discount.type === 'Percent' ? 'Percentage off' : 'Fixed amount off'}
                  </p>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>Starts: {new Date(discount.startsAt).toLocaleDateString()}</p>
                  {discount.endsAt && (
                    <p>Ends: {new Date(discount.endsAt).toLocaleDateString()}</p>
                  )}
                
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => openEditModal(discount)}
                      className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                    >
                      Edit
                    </button>
                    {discount.status === 'Active' ? (
                      <button
                        onClick={() => deactivateDiscount(discount)}
                        className="px-3 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => activateDiscount(discount)}
                        className="px-3 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => deleteDiscount(discount.id)}
                      className="px-3 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
