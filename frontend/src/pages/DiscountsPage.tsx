import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Tag } from 'lucide-react';

export default function DiscountsPage() {
  const { user } = useAuthStore();
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiscounts();
  }, []);

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
          <button className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
            <Plus className="w-5 h-5" />
            <span>Create Discount</span>
          </button>
        )}
      </div>

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
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
