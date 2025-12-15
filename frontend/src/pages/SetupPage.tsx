import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function SetupPage() {
  const navigate = useNavigate();
  const { token, user, setAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Business creation form state (SuperAdmin only)
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [priceIncludesTax, setPriceIncludesTax] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const resolveBusiness = async () => {
      try {
        // If user already has business, go to dashboard
        if (user?.businessId) {
          navigate('/');
          return;
        }

        // Try to fetch employee record and infer business
        if (user?.id) {
          const res = await api.get(`/employees/${user.id}`);
          const bizId = res.data?.business?.id;
          if (bizId) {
            // Update store with inferred businessId
            if (token) {
              setAuth(token, { ...user!, businessId: bizId });
            }
            toast.success('Business detected, loading dashboard');
            navigate('/');
            return;
          }
        }
      } catch (e) {
        // No employee record or forbidden
      } finally {
        setLoading(false);
      }
    };
    resolveBusiness();
  }, [navigate, setAuth, token, user]);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'SuperAdmin') return;
    try {
      setCreating(true);
      const body: any = {
        name,
        countryCode: (countryCode || '').toUpperCase().slice(0, 2),
        priceIncludesTax,
        ownerEmail,
        ownerName,
      };
      const res = await api.post('/businesses', body);
      const { business, owner } = res.data || {};
      toast.success(`Business "${business?.name}" created. Owner: ${owner?.email}`);
      // Note: SuperAdmin is not attached to the business by design.
      // You can now log in as the owner or continue setup.
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create business';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'SuperAdmin';

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Setup Required</h1>
      {!user?.businessId && (
        <p className="text-gray-600 mb-6">
          Your account is not associated with a business. {isSuperAdmin
            ? 'Create a new business below. Note: Use a different email for the business owner (not your SuperAdmin email).'
            : 'Please contact your administrator to be added to a business.'}
        </p>
      )}

      {isSuperAdmin ? (
        <form onSubmit={handleCreateBusiness} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
              <input
                type="text"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                maxLength={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                id="price-includes-tax"
                type="checkbox"
                checked={priceIncludesTax}
                onChange={(e) => setPriceIncludesTax(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="price-includes-tax" className="text-sm text-gray-700">Prices include tax</label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email</label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              placeholder="owner@example.com (use a different email)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Must be different from your SuperAdmin email ({user?.email})</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Back to Login
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Business'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-700">You are not associated with any business. Please contact your administrator to be added.</p>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => logout()}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
