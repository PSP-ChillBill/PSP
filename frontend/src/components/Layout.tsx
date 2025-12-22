import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Calendar,
  Tag,
  Gift,
  Archive,
  Clock3,
  LogOut,
  Percent,
  LayoutGrid
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Employees', href: '/employees', icon: Users, roles: ['SuperAdmin', 'Owner', 'Manager'] },
    { name: 'Catalog', href: '/catalog', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Reservations', href: '/reservations', icon: Calendar },
    { name: 'Tables', href: '/tables', icon: LayoutGrid, roles: ['SuperAdmin', 'Owner', 'Manager'] },
    { name: 'Discounts', href: '/discounts', icon: Tag, roles: ['SuperAdmin', 'Owner', 'Manager'] },
    { name: 'Gift Cards', href: '/gift-cards', icon: Gift, roles: ['SuperAdmin', 'Owner', 'Manager'] },
    { name: 'Taxes', href: '/taxes', icon: Percent, roles: ['SuperAdmin', 'Owner'] },
    { name: 'Inventory', href: '/inventory', icon: Archive, roles: ['SuperAdmin', 'Owner', 'Manager'] },
    { name: 'Activity Log', href: '/activity', icon: Clock3, roles: ['Owner'] },
  ];

  const filteredNav = navigation.filter(
    (item) => !item.roles || item.roles.includes(user?.role || '')
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg h-screen fixed left-0 top-0 flex flex-col">
          <div className="p-4 border-b flex-shrink-0">
            <h1 className="text-2xl font-bold text-primary-600">POS System</h1>
            <p className="text-sm text-gray-600 mt-1">{user?.business?.name || 'Admin'}</p>
          </div>

          <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-primary-600 transition"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t bg-white flex-shrink-0">
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 ml-64">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
