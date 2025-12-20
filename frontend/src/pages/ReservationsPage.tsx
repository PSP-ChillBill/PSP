import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trash, Clock } from 'lucide-react';
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState<any[]>([]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // New reservation form state
  const [selectedTime, setSelectedTime] = useState<string>('18:00');
  const [durationMin, setDurationMin] = useState<number>(60);
  const [customerName, setCustomerName] = useState<string>('');
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const isManager = user?.role === 'Manager' || user?.role === 'Owner' || user?.role === 'SuperAdmin';
  const [newSeatName, setNewSeatName] = useState('');
  const [newSeatCapacity, setNewSeatCapacity] = useState<number>(2);

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/reservations', {
        params: { businessId: user?.businessId },
      });
      setReservations(response.data);
    } catch (error) {
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, [user?.businessId]);

  const loadSeats = useCallback(async () => {
    try {
      if (!user?.businessId) return;
      const res = await api.get('/seats', { params: { businessId: user.businessId } });
      setSeats(res.data);
    } catch (e) {
      // seats might not exist yet; avoid noisy error
    }
  }, [user?.businessId]);

  useEffect(() => {
    loadReservations();
    loadSeats();
  }, [loadReservations, loadSeats]);

  const daysInCalendar = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = gridStart;
    while (day <= gridEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const timeSlotOptions = useMemo(() => {
    return Array.from({ length: 24 * 2 }).map((_, i) => {
      const hh = Math.floor(i / 2)
        .toString()
        .padStart(2, '0');
      const mm = i % 2 === 0 ? '00' : '30';
      const label = `${hh}:${mm}`;
      return { label, value: label };
    });
  }, []);

  const createReservation = async () => {
    try {
      if (!user?.businessId) return;
      if (!selectedDate) {
        toast.error('Please select a date');
        return;
      }
      if (!customerName.trim()) {
        toast.error('Please enter customer name');
        return;
      }
      setCreating(true);
      const [hh, mm] = selectedTime.split(':').map((v) => parseInt(v, 10));
      const start = new Date(selectedDate.getTime());
      start.setHours(hh, mm, 0, 0);

      const payload = {
        businessId: user.businessId,
        customerName,
        appointmentStart: start.toISOString(),
        plannedDurationMin: durationMin,
        services: [],
        seatIds: selectedSeatIds,
      };

      await api.post('/reservations', payload);
      toast.success('Reservation created');
      setCustomerName('');
      setSelectedSeatIds([]);
      await Promise.all([loadReservations(), loadSeats()]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to create reservation';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const checkInReservation = async (id: number) => {
    try {
      await api.post(`/reservations/${id}/complete`);
      toast.success('Reservation checked in');
      await loadReservations();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to check in reservation';
      toast.error(msg);
    }
  };

  const cancelReservation = async (id: number) => {
    try {
      await api.post(`/reservations/${id}/cancel`);
      toast.success('Reservation cancelled');
      await loadReservations();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to cancel reservation';
      toast.error(msg);
    }
  };

  const expireReservations = async () => {
    try {
      await api.post('/reservations/expire');
      toast.success('Expired overdue reservations');
      await loadReservations();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to expire reservations';
      toast.error(msg);
    }
  };

  const deleteSeat = async (id: number) => {
    try {
      await api.post(`/seats/${id}/deactivate`);
      setSelectedSeatIds((prev) => prev.filter((sid) => sid !== id));
      await loadSeats();
      toast.success('Seat deactivated');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to deactivate seat';
      toast.error(msg);
    }
  };

  const deleteReservation = async (id: number) => {
    try {
      await api.delete(`/reservations/${id}`);
      toast.success('Reservation deleted');
      await loadReservations();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to delete reservation';
      toast.error(msg);
    }
  };

  const addSeat = async () => {
    try {
      if (!isManager) return;
      if (!newSeatName.trim()) {
        toast.error('Seat name is required');
        return;
      }
      await api.post('/seats', {
        businessId: user!.businessId,
        name: newSeatName.trim(),
        capacity: newSeatCapacity,
      });
      setNewSeatName('');
      setNewSeatCapacity(2);
      await loadSeats();
      toast.success('Seat added');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to add seat';
      toast.error(msg);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reservations</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-2 rounded-lg bg-white shadow hover:bg-gray-50"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-3 py-2 bg-white rounded-lg shadow text-gray-800 font-medium">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg bg-white shadow hover:bg-gray-50"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {isManager && (
            <button
              onClick={expireReservations}
              className="ml-2 flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              title="Expire overdue"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm">Expire Overdue</span>
            </button>
          )}
        </div>
      </div>

      {/* Create Reservation Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Calendar */}
        <div className="bg-white rounded-lg shadow p-4 xl:col-span-2">
          <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-500 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {daysInCalendar.map((day) => {
              const isCurrent = isSameDay(day, selectedDate || new Date());
              const outside = !isSameMonth(day, currentMonth);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={
                    'aspect-square rounded-md p-2 text-sm transition border ' +
                    (isCurrent
                      ? 'bg-primary-600 text-white border-primary-600'
                      : outside
                      ? 'text-gray-400 border-transparent hover:bg-gray-50'
                      : 'text-gray-800 border-transparent hover:bg-gray-50')
                  }
                >
                  <div className="text-right">{format(day, 'd')}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Reservation</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <div className="px-3 py-2 bg-gray-50 rounded border text-gray-800">
                {selectedDate ? format(selectedDate, 'PPPP') : 'Select date'}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Time</label>
              <select
                className="w-full px-3 py-2 border rounded bg-white"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              >
                {timeSlotOptions.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={15}
                step={15}
                className="w-full px-3 py-2 border rounded"
                value={durationMin}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = parseInt(raw, 10);
                  const fallback = 60;
                  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
                  setDurationMin(Math.max(15, normalized));
                }}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Customer Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., John Smith"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">Select Seats</label>
              {seats.length === 0 ? (
                <div className="text-sm text-gray-500">No seats yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                  {seats.map((s) => {
                    const checked = selectedSeatIds.includes(s.id);
                    return (
                      <div key={s.id} className={`flex items-center gap-2 px-3 py-2 border rounded ${checked ? 'bg-primary-50 border-primary-300' : ''}`}>
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedSeatIds((prev) =>
                                e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                              );
                            }}
                            aria-label={`Select seat ${s.name}`}
                          />
                          <span className="text-sm text-gray-800">{s.name}</span>
                          <span className="ml-auto text-xs text-gray-500">{s.capacity}</span>
                        </label>
                        {isManager && (
                          <button
                            onClick={(e) => { e.preventDefault(); deleteSeat(s.id); }}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Delete seat"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isManager && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Add Seat (manager)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="Seat name (e.g., T1)"
                    value={newSeatName}
                    onChange={(e) => setNewSeatName(e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    className="w-24 px-3 py-2 border rounded"
                    value={newSeatCapacity}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value || '1', 10);
                      const safeValue =
                        !Number.isNaN(parsed) && parsed >= 1 ? parsed : 1;
                      setNewSeatCapacity(safeValue);
                    }}
                  />
                  <button
                    onClick={addSeat}
                    className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-black"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={createReservation}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              <Plus className="w-5 h-5" /> Create Reservation
            </button>
          </div>
        </div>
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
                  <div className="flex items-center gap-2">
                    {isManager && reservation.status !== 'Booked' && (
                      <button
                        onClick={() => deleteReservation(reservation.id)}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Delete reservation"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(reservation.status)}`}>
                      {reservation.status}
                    </span>
                  </div>
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

                {reservation.seats && reservation.seats.length > 0 && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Seats:</p>
                    <p className="text-sm text-gray-600">
                      {reservation.seats.map((s: any) => s.seat.name).join(', ')}
                    </p>
                  </div>
                )}

                {reservation.notes && (
                  <p className="text-sm text-gray-600 italic">{reservation.notes}</p>
                )}

                <div className="mt-4 pt-4 border-t flex space-x-2">
                  <button
                    onClick={() => checkInReservation(reservation.id)}
                    disabled={reservation.status !== 'Booked'}
                    className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-60"
                  >
                    Check In
                  </button>
                  <button
                    onClick={() => cancelReservation(reservation.id)}
                    disabled={reservation.status !== 'Booked'}
                    className="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-60"
                  >
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
