import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Gift as GiftIcon, X, Copy, Check } from 'lucide-react';

export default function GiftCardsPage() {
  const { user } = useAuthStore();
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<any | null>(null);

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gift-cards', {
        params: { businessId: user?.businessId },
      });
      setGiftCards(response.data);
    } catch (error) {
      toast.error('Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleStatus = async (card: any) => {
    if (!['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '')) {
      toast.error('Not authorized');
      return;
    }

    const confirmMsg =
      card.status === 'Active'
        ? `Are you sure you want to block gift card ${card.code}?`
        : `Are you sure you want to activate gift card ${card.code}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const newStatus = card.status === 'Active' ? 'Blocked' : 'Active';
      await api.put(`/gift-cards/${card.id}/status`, { status: newStatus });
      toast.success(`Gift card ${card.code} is now ${newStatus}`);
      await loadGiftCards();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const handleEdit = (card: any) => {
    setEditingCard({
      ...card,
      expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString().slice(0, 10) : '',
      initialValue: parseFloat(card.initialValue).toFixed(2),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gift Cards</h1>
        {['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Issue Gift Card</span>
          </button>
        )}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initial Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {giftCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <GiftIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No gift cards issued</p>
                  </td>
                </tr>
              ) : (
                giftCards.map((card) => (
                  <tr key={card.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900 flex items-center space-x-2">
                      <span>{card.code}</span>
                      <button
                        onClick={() => handleCopy(card.code)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy code"
                      >
                        {copiedCode === card.code ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      €{parseFloat(card.initialValue).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      €{parseFloat(card.balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(card.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${card.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : card.status === 'Blocked'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {card.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '') ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(card)}
                            className="px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleToggleStatus(card)}
                            className={`px-3 py-1 rounded-md text-sm ${card.status === 'Active'
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                          >
                            {card.status === 'Active' ? 'Block' : 'Unblock'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <IssueGiftCardModal onClose={() => setShowModal(false)} onSuccess={loadGiftCards} />
      )}

      {editingCard && (
        <EditGiftCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSuccess={() => {
            setEditingCard(null);
            loadGiftCards();
          }}
        />
      )}
    </div>
  );
}

function IssueGiftCardModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.businessId) {
      toast.error('Business not configured');
      return;
    }

    if (!value || parseFloat(value) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        businessId: user.businessId,
        initialValue: parseFloat(value),
      };

      if (expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      }

      const res = await api.post('/gift-cards', payload);
      setIssuedCode(res.data.code);
      toast.success(`Gift card issued: ${res.data.code}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to issue gift card');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (issuedCode) {
      navigator.clipboard.writeText(issuedCode);
      toast.success('Code copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Issue Gift Card</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!issuedCode ? (
          <form onSubmit={handleIssue} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder="50.00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date (optional)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
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
                {submitting ? 'Issuing...' : 'Issue Gift Card'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 text-center space-y-4">
            <GiftIcon className="w-16 h-16 text-green-500 mx-auto" />
            <div>
              <p className="text-sm text-gray-600 mb-2">Gift Card Issued Successfully</p>
              <p className="text-lg font-mono font-bold text-gray-900 bg-gray-50 p-3 rounded">
                {issuedCode}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="w-full px-4 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Code</span>
            </button>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditGiftCardModal({
  card,
  onClose,
  onSuccess,
}: {
  card: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [value, setValue] = useState<string>(card.initialValue ? String(card.initialValue) : '');
  const [expiresAt, setExpiresAt] = useState<string>(card.expiresAt || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!user?.businessId) {
      toast.error('Business not configured');
      return;
    }

    if (!value || parseFloat(value) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        initialValue: parseFloat(value),
      };
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
      else payload.expiresAt = null;

      await api.put(`/gift-cards/${card.id}`, payload);

      toast.success('Gift card updated');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update gift card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit Gift Card</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <div className="w-full rounded-md border border-gray-200 px-3 py-2 bg-gray-50 font-mono">
              {card.code}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              placeholder="50.00"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to set no expiration</p>
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
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
