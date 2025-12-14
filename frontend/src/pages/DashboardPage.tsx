import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    todaySales: 0,
    openOrders: 0,
    todayReservations: 0,
    activeEmployees: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // In production, create a dedicated stats endpoint
      const today = new Date().toISOString().split('T')[0];
      
      const [orders, reservations, employees] = await Promise.all([
        api.get('/orders', { params: { status: 'Open' } }),
        api.get('/reservations', { params: { status: 'Booked', startDate: today } }),
        api.get('/employees', { params: { businessId: user?.businessId } }),
      ]);

      setStats({
        todaySales: 0, // Would calculate from closed orders
        openOrders: orders.data.length,
        todayReservations: reservations.data.length,
        activeEmployees: employees.data.filter((e: any) => e.status === 'Active').length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {loading ? (
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <p className="text-gray-500">No recent activity</p>
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
