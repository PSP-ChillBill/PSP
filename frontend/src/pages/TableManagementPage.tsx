import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, RefreshCcw, Trash, Plus } from 'lucide-react';

interface Seat {
  id: number;
  name: string;
  capacity: number;
  status: string;
}

interface Reservation {
  id: number;
  appointmentStart: string;
  appointmentEnd: string;
  status: string;
  seats?: Array<{ seat: Seat }>;
}

interface Order {
  id: number;
  status: string;
  tableOrArea?: string;
}

export default function TableManagementPage() {
  const { user } = useAuthStore();
  const [tables, setTables] = useState<Seat[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState(2);

  const loadTables = useCallback(async () => {
    if (!user?.businessId) return;
    try {
      const res = await api.get('/seats', { params: { businessId: user.businessId, includeInactive: true } });
      setTables(res.data);
    } catch (e) {
      toast.error('Failed to load tables');
    }
  }, [user?.businessId]);

  const loadReservations = useCallback(async () => {
    if (!user?.businessId) return;
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const res = await api.get('/reservations', {
        params: {
          businessId: user.businessId,
          status: 'Booked',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      setReservations(res.data);
    } catch (e) {
      // silently ignore
    }
  }, [user?.businessId]);

  const loadOrders = useCallback(async () => {
    if (!user?.businessId) return;
    try {
      const res = await api.get('/orders', {
        params: {
          businessId: user.businessId,
          status: 'Open',
        },
      });
      setOrders(res.data);
    } catch (e) {
      // silently ignore
    }
  }, [user?.businessId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadTables(), loadReservations(), loadOrders()]);
      setLoading(false);
    })();
  }, [loadTables, loadReservations, loadOrders]);

  const now = useMemo(() => new Date(), []);
  
  const tableWithOrders = useMemo(() => {
    const tableNames = new Set<string>();
    orders.forEach((o) => {
      if (o.status === 'Open' && o.tableOrArea) {
        tableNames.add(o.tableOrArea);
      }
    });
    return tableNames;
  }, [orders]);

  const reservedTableIds = useMemo(() => {
    const ids = new Set<number>();
    reservations.forEach((r) => {
      const start = new Date(r.appointmentStart);
      const end = new Date(r.appointmentEnd);
      if (r.status === 'Booked' && start <= now && now <= end && r.seats) {
        r.seats.forEach((s) => ids.add(s.seat.id));
      }
    });
    return ids;
  }, [reservations, now]);

  const getUpcomingReservation = (tableId: number) => {
    const upcoming = reservations.find((r) => {
      const start = new Date(r.appointmentStart);
      if (r.status === 'Booked' && start > now && r.seats) {
        return r.seats.some((s) => s.seat.id === tableId);
      }
      return false;
    });
    if (upcoming) {
      const start = new Date(upcoming.appointmentStart);
      const diffMs = start.getTime() - now.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      return diffMin;
    }
    return null;
  };

  const addTable = async () => {
    if (!user?.businessId) return;
    if (!newName.trim()) {
      toast.error('Table name is required');
      return;
    }
    try {
      await api.post('/seats', { businessId: user.businessId, name: newName.trim(), capacity: newCapacity });
      setNewName('');
      setNewCapacity(2);
      await loadTables();
      toast.success('Table added');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to add table');
    }
  };

  const deactivateTable = async (id: number) => {
    try {
      await api.post(`/seats/${id}/deactivate`);
      await loadTables();
      toast.success('Marked Unavailable');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to mark unavailable');
    }
  };

  const activateTable = async (id: number) => {
    try {
      await api.post(`/seats/${id}/activate`);
      await loadTables();
      toast.success('Marked Available');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to mark available');
    }
  };

  const deleteTable = async (id: number) => {
    try {
      await api.delete(`/seats/${id}`);
      await loadTables();
      toast.success('Table deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete table');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Table Management</h1>
        <button
          onClick={() => { loadTables(); loadReservations(); loadOrders(); }}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded hover:bg-gray-50"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-lg shadow p-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved Now</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tables.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{t.capacity}</td>
                  <td className="px-6 py-4 text-sm">
                    {t.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                        <XCircle className="w-3 h-3" /> Unavailable
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {tableWithOrders.has(t.name) ? (
                      <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full font-medium">Occupied</span>
                    ) : reservedTableIds.has(t.id) ? (
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">Reserved</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full inline-block">Free</span>
                        {(() => {
                          const upcomingMin = getUpcomingReservation(t.id);
                          if (upcomingMin !== null && upcomingMin <= 120) {
                            return (
                              <span className="text-xs text-amber-600 italic">
                                Reserved in {upcomingMin}min
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === 'Active' ? (
                        <button 
                          onClick={() => deactivateTable(t.id)} 
                          className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
                        >
                          Mark Unavailable
                        </button>
                      ) : (
                        <button 
                          onClick={() => activateTable(t.id)} 
                          className="px-3 py-1.5 text-sm border border-green-300 bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                        >
                          Mark Available
                        </button>
                      )}
                      <button 
                        onClick={() => deleteTable(t.id)} 
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete table"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {['SuperAdmin', 'Owner', 'Manager'].includes(user?.role || '') && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Table</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., T1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Capacity</label>
                <input
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 border rounded"
                  value={newCapacity}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value || '2', 10);
                    setNewCapacity(!Number.isNaN(parsed) && parsed >= 1 ? parsed : 2);
                  }}
                />
              </div>
              <button onClick={addTable} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Plus className="w-5 h-5" /> Add Table
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
