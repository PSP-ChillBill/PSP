import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { CalendarClock, Clock3, Gift, Package, ShoppingCart, DollarSign } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'order' | 'payment' | 'reservation' | 'stock' | 'giftcard';
  occurredAt: string;
  title: string;
  description?: string;
  actorName?: string;
};

type ActivityResponse = {
  items: ActivityItem[];
  nextCursor?: string;
};

export default function ActivityLogPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [prevStack, setPrevStack] = useState<(string | undefined)[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'Owner') {
      navigate('/');
      return;
    }
    resetAndLoad();
  }, [user?.businessId, user?.role]);

  const resetAndLoad = () => {
    setPrevStack([]);
    setCursor(undefined);
    fetchPage(undefined);
  };

  const fetchPage = async (cursorParam?: string) => {
    try {
      setLoading(true);
      const params: Record<string, any> = { limit: 10 };
      if (user?.businessId) params.businessId = user.businessId;
      if (cursorParam) params.cursor = cursorParam;

      const response = await api.get<ActivityResponse>('/activity', { params });
      setItems(response.data.items || []);
      setNextCursor(response.data.nextCursor);
      setCursor(cursorParam);
    } catch (error) {
      console.error('Failed to load activity log:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!nextCursor) return;
    setPrevStack((prev) => [...prev, cursor]);
    fetchPage(nextCursor);
  };

  const handlePrev = () => {
    setPrevStack((prev) => {
      const copy = [...prev];
      const prevCursorValue = copy.pop();
      fetchPage(prevCursorValue);
      return copy;
    });
  };

  const activityIconMap: Record<ActivityItem['type'], LucideIcon> = {
    order: ShoppingCart,
    payment: DollarSign,
    reservation: CalendarClock,
    stock: Package,
    giftcard: Gift,
  };

  const activityColorMap: Record<ActivityItem['type'], string> = {
    order: 'bg-blue-100 text-blue-700',
    payment: 'bg-green-100 text-green-700',
    reservation: 'bg-purple-100 text-purple-700',
    stock: 'bg-amber-100 text-amber-700',
    giftcard: 'bg-pink-100 text-pink-700',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600">Latest activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={handlePrev}
            disabled={loading || prevStack.length === 0}
          >
            Previous
          </button>
          <button
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={handleNext}
            disabled={loading || !nextCursor}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No activity found.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = activityIconMap[item.type] || Clock3;
            const colors = activityColorMap[item.type];
            return (
              <div key={item.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-4 bg-white shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${colors}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    {item.actorName && (
                      <p className="text-xs text-gray-500">By {item.actorName}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
