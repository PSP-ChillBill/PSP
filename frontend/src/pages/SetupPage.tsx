import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface Business {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  countryCode: string;
  priceIncludesTax: boolean;
  createdAt: string;
  _count: {
    employees: number;
    orders: number;
  };
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    countryCode: 'US',
    priceIncludesTax: false,
    ownerEmail: '',
    ownerName: '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Redirect non-SuperAdmin users
    if (user?.role !== 'SuperAdmin') {
      navigate('/');
      return;
    }
    loadBusinesses();
  }, [user, navigate]);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/businesses');
      setBusinesses(res.data);
    } catch (error: any) {
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const body = {
        name: formData.name,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        countryCode: formData.countryCode.toUpperCase().slice(0, 2),
        priceIncludesTax: formData.priceIncludesTax,
        ownerEmail: formData.ownerEmail,
        ownerName: formData.ownerName,
      };
      await api.post('/businesses', body);
      toast.success(`Business "${formData.name}" created successfully`);
      setShowCreateModal(false);
      resetForm();
      loadBusinesses();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create business';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    try {
      setSubmitting(true);
      const body = {
        name: formData.name,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        countryCode: formData.countryCode.toUpperCase().slice(0, 2),
        priceIncludesTax: formData.priceIncludesTax,
      };
      await api.put(`/businesses/${selectedBusiness.id}`, body);
      toast.success('Business updated successfully');
      setShowEditModal(false);
      setSelectedBusiness(null);
      resetForm();
      loadBusinesses();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to update business';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBusiness = async (business: Business) => {
    if (!confirm(`Are you sure you want to delete "${business.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/businesses/${business.id}`);
      toast.success('Business deleted successfully');
      loadBusinesses();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete business';
      toast.error(message);
    }
  };

  const openEditModal = (business: Business) => {
    setSelectedBusiness(business);
    setFormData({
      name: business.name,
      address: business.address || '',
      phone: business.phone || '',
      email: business.email || '',
      countryCode: business.countryCode,
      priceIncludesTax: business.priceIncludesTax,
      ownerEmail: '',
      ownerName: '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      countryCode: 'US',
      priceIncludesTax: false,
      ownerEmail: '',
      ownerName: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Business Administration</h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Create Business
        </button>
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {businesses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No businesses found.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {businesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{business.name}</div>
                    <div className="text-xs text-gray-500">{business.address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{business.countryCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{business._count.employees}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{business._count.orders}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{business.email}</div>
                    <div className="text-xs text-gray-500">{business.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(business)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBusiness(business)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Business</h2>
            <form onSubmit={handleCreateBusiness} className="space-y-4">
              {/* Business Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="US"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.priceIncludesTax}
                      onChange={(e) => setFormData({ ...formData, priceIncludesTax: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Price Includes Tax</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Owner Information */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Business Owner</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.ownerEmail}
                      onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="owner@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use a different email than your SuperAdmin account</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Business Modal */}
      {showEditModal && selectedBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Business</h2>
            <form onSubmit={handleUpdateBusiness} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.priceIncludesTax}
                      onChange={(e) => setFormData({ ...formData, priceIncludesTax: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Price Includes Tax</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBusiness(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
