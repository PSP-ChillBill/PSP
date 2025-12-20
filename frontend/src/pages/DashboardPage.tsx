import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { CalendarClock, Clock3, Gift, Package, TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';
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

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    todaySales: 0,
    openOrders: 0,
    todayReservations: 0,
    activeEmployees: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    loadStats();
    resetAndLoadActivity();
  }, [user?.businessId]);

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const [orders, reservations, employees] = await Promise.all([
        api.get('/orders', { params: { status: 'Open' } }),
        api.get('/reservations', { params: { status: 'Booked', startDate: today } }),
        api.get('/employees', { params: { businessId: user?.businessId } }),
      ]);

      setStats({
        todaySales: 0,
        openOrders: orders.data.length,
        todayReservations: reservations.data.length,
        activeEmployees: employees.data.filter((e: any) => e.status === 'Active').length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const resetAndLoadActivity = () => {
    setActivity([]);
    loadActivity();
  };

  const loadActivity = async () => {
    try {
      setActivityLoading(true);
      const params: Record<string, any> = {};
      if (user?.businessId) params.businessId = user.businessId;
      params.limit = 3;

      const response = await api.get<ActivityResponse>('/activity', { params });
      const nextItems = response.data.items || [];
      setActivity(nextItems);
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const statCards = [
    {
      name: "Today's Sales",
      value: `€${stats.todaySales.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      name: 'Open Orders',
      value: stats.openOrders.toString(),
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      name: "Today's Reservations",
      value: stats.todayReservations.toString(),
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      name: 'Active Employees',
      value: stats.activeEmployees.toString(),
      icon: Users,
      color: 'bg-orange-500',
    },
  ];

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat) => (
              <div key={stat.name} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                {user?.role === 'Owner' && (
                  <a
                    href="/activity"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    View more
                  </a>
                )}
              </div>
              {activityLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : activity.length === 0 ? (
                <p className="text-gray-500">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => {
                    const Icon = activityIconMap[item.type] || Clock3;
                    const colors = activityColorMap[item.type];
                    return (
                      <div key={item.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3">
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

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <a
                  href="/orders"
                  className="block px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition"
                >
                  Create New Order
                </a>
                <a
                  href="/reservations"
                  className="block px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition"
                >
                  New Reservation
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
