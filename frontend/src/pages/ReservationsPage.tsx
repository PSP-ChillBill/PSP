import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reservations', {
        params: { businessId: user?.businessId, status: 'Booked' },
      });
      setReservations(response.data);
    } catch (error) {
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reservations</h1>
        <button className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
          <Plus className="w-5 h-5" />
          <span>New Reservation</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {reservations.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-white rounded-lg shadow">
              <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No upcoming reservations</p>
            </div>
          ) : (
            reservations.map((reservation) => (
              <div key={reservation.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {reservation.customerName}
                    </h3>
                    <p className="text-sm text-gray-500">{reservation.customerEmail}</p>
                    {reservation.customerPhone && (
                      <p className="text-sm text-gray-500">{reservation.customerPhone}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {reservation.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    <span>{format(new Date(reservation.appointmentStart), 'PPp')}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Duration: {reservation.plannedDurationMin} minutes
                  </div>
                  {reservation.employee && (
                    <div className="text-sm text-gray-600">
                      With: {reservation.employee.name}
                    </div>
                  )}
                </div>

                {reservation.services && reservation.services.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Services:</p>
                    {reservation.services.map((service: any) => (
                      <p key={service.id} className="text-sm text-gray-600">
                        • {service.catalogItem.name}
                      </p>
                    ))}
                  </div>
                )}

                {reservation.notes && (
                  <p className="text-sm text-gray-600 italic">{reservation.notes}</p>
                )}

                <div className="mt-4 pt-4 border-t flex space-x-2">
                  <button className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                    Check In
                  </button>
                  <button className="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
