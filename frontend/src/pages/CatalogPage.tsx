import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

export default function CatalogPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Product' | 'Service'>('all');
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'Product' | 'Service'>('Product');
  const [formBasePrice, setFormBasePrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [formTaxClass, setFormTaxClass] = useState('Food');
  const [formDurationMin, setFormDurationMin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [filter]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/catalog/categories', {
        params: { businessId: user?.businessId },
      });
      setCategories(response.data);
    } catch (error) {
      // Categories are optional
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const params: any = { businessId: user?.businessId };
      if (filter !== 'all') params.type = filter;

      const response = await api.get('/catalog/items', { params });
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load catalog items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormName('');
    setFormCode('');
    setFormType('Product');
    setFormBasePrice('');
    setFormDescription('');
    setFormCategoryId(null);
    setFormTaxClass('Food');
    setFormDurationMin('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.businessId) {
      toast.error('Business not configured');
      return;
    }
    
    try {
      setSubmitting(true);
      const payload: any = {
        businessId: user.businessId,
        name: formName,
        code: formCode,
        type: formType,
        basePrice: parseFloat(formBasePrice),
        taxClass: formTaxClass,
        status: 'Active',
      };
      
      if (formDescription) payload.description = formDescription;
      if (formCategoryId) payload.categoryId = formCategoryId;
      if (formType === 'Service' && formDurationMin) {
        payload.defaultDurationMin = parseInt(formDurationMin);
      }
      
      await api.post('/catalog/items', payload);
      toast.success(`{formType} EUR created successfully`);
      setShowModal(false);
      await loadItems();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create item';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Catalog</h1>
        {['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '') && (
          <button 
            onClick={handleCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      <div className="mb-4 flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('Product')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'Product'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Products
        </button>
        <button
          onClick={() => setFilter('Service')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'Service'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Services
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.code}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    item.type === 'Service'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {item.type}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">€{item.basePrice}</span>
                <span className="text-sm text-gray-500">{item.taxClass}</span>
              </div>
              {item.defaultDurationMin && (
                <p className="text-sm text-gray-500 mt-2">{item.defaultDurationMin} min</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Add Catalog Item</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'Product' | 'Service')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Product">Product (food, parts, retail items)</option>
                    <option value="Service">Service (haircut, repair, dining)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      placeholder="e.g., Haircut, Burger, Oil Change"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code/SKU <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      required
                      placeholder="e.g., HAIR-001, BURG-001"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formBasePrice}
                      onChange={(e) => setFormBasePrice(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Class <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formTaxClass}
                      onChange={(e) => setFormTaxClass(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Food">Food</option>
                      <option value="Service">Service</option>
                      <option value="Alcohol">Alcohol</option>
                      <option value="Other">Other/Retail</option>
                    </select>
                  </div>
                </div>

                {formType === 'Service' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formDurationMin}
                      onChange={(e) => setFormDurationMin(e.target.value)}
                      placeholder="e.g., 30, 60, 90"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategoryId ?? ''}
                    onChange={(e) => setFormCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">None</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    placeholder="Optional details about this item..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
