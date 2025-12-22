import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import CatalogPage from './pages/CatalogPage';
import OrdersPage from './pages/OrdersPage';
import PaymentsPage from './pages/PaymentsPage';
import ReservationsPage from './pages/ReservationsPage';
import DiscountsPage from './pages/DiscountsPage';
import GiftCardsPage from './pages/GiftCardsPage';
import InventoryPage from './pages/InventoryPage';
import ActivityLogPage from './pages/ActivityLogPage';
import TableManagementPage from './pages/TableManagementPage';
import TaxManagementPage from './pages/TaxesPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" />;
  if (!user?.businessId) return <Navigate to="/admin" />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="tables" element={<TableManagementPage />} />
        <Route path="discounts" element={<DiscountsPage />} />
        <Route path="gift-cards" element={<GiftCardsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="activity" element={<ActivityLogPage />} />
        <Route path="taxes" element={<TaxManagementPage />} />
      </Route>
    </Routes>
  );
}

export default App;
