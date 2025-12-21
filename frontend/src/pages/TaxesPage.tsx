import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { PlusCircle, Edit, Trash2, RefreshCw } from 'lucide-react';

type TaxRule = {
    id: number;
    countryCode: string;
    taxClass: string;
    ratePercent: number;
    validFrom: string | null;
    validTo: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export default function TaxManagementPage() {
    const { user } = useAuthStore();
    const [taxes, setTaxes] = useState<TaxRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCountry, setFilterCountry] = useState('');
    const [filterClass, setFilterClass] = useState('');

    // create / edit form state
    const emptyForm = { countryCode: '', taxClass: '', ratePercent: '', validFrom: '', validTo: '' };
    const [form, setForm] = useState<any>(emptyForm);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadTaxes();
    }, []);

    const loadTaxes = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (filterCountry) params.countryCode = filterCountry;
            if (filterClass) params.taxClass = filterClass;
            const res = await api.get('/taxes', { params });
            setTaxes(res.data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load tax rules');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setForm(emptyForm);
        setIsEditing(false);
        setEditingId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openEdit = (t: TaxRule) => {
        setForm({
            countryCode: t.countryCode,
            taxClass: t.taxClass,
            ratePercent: String(t.ratePercent),
            validFrom: t.validFrom ? t.validFrom.slice(0, 10) : '',
            validTo: t.validTo ? t.validTo.slice(0, 10) : '',
        });
        setIsEditing(true);
        setEditingId(t.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!user) return toast.error('Not authenticated');
        if (!user.role || user.role !== 'SuperAdmin') return toast.error('Only SuperAdmin can perform this action');

        if (!form.countryCode || form.countryCode.length !== 2) return toast.error('Country code must have 2 characters');
        if (!form.taxClass) return toast.error('Tax class is required');
        if (form.ratePercent === '' || isNaN(parseFloat(form.ratePercent))) return toast.error('Rate is required and must be a number');

        try {
            setSaving(true);

            const payload: any = {
                countryCode: form.countryCode.toUpperCase(),
                taxClass: form.taxClass,
                ratePercent: parseFloat(form.ratePercent),
                validFrom: form.validFrom ? form.validFrom : new Date().toISOString(),
                validTo: form.validTo ? form.validTo : undefined,
            };

            await api.post('/taxes', payload);
            toast.success(isEditing ? 'New tax version created' : 'Tax created');

            if (isEditing && editingId) {
                try {
                    await api.delete(`/taxes/${editingId}`);
                } catch (delErr) {
                    console.error('Failed to deactivate old tax', delErr);
                    toast.error('Created new tax but failed to deactivate old version');
                }
            }

            openCreate();
            await loadTaxes();
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data || err.message || 'Failed to save tax';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const deactivate = async (id: number) => {
        if (!confirm('Deactivate this tax rule? This cannot be undone.')) return;
        try {
            await api.delete(`/taxes/${id}`);
            toast.success('Tax deactivated');
            await loadTaxes();
        } catch (err) {
            console.error(err);
            toast.error('Failed to deactivate tax');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Tax Management</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            placeholder="Country (e.g. US)"
                            maxLength={2}
                            value={filterCountry}
                            onChange={(e) => setFilterCountry(e.target.value.toUpperCase())}
                            className="border px-2 py-1 rounded w-28 text-sm"
                        />
                        <input
                            placeholder="Tax class"
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="border px-2 py-1 rounded w-36 text-sm"
                        />
                        <button
                            onClick={loadTaxes}
                            className="px-3 py-1 bg-gray-100 rounded flex items-center gap-2 text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>

                    {user?.role === 'SuperAdmin' && (
                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded shadow-sm text-sm"
                        >
                            <PlusCircle className="w-4 h-4" />
                            New Tax
                        </button>
                    )}
                </div>
            </div>

            {/* Form */}
            {user?.role === 'SuperAdmin' && (
                <form onSubmit={submit} className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-gray-600">Country Code</label>
                            <input
                                value={form.countryCode}
                                onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
                                className="mt-1 border rounded px-2 py-1 w-full"
                                maxLength={2}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600">Tax Class</label>
                            <input
                                value={form.taxClass}
                                onChange={(e) => setForm({ ...form, taxClass: e.target.value })}
                                className="mt-1 border rounded px-2 py-1 w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600">Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.ratePercent}
                                onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                                className="mt-1 border rounded px-2 py-1 w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600">Valid From</label>
                            <input
                                type="date"
                                value={form.validFrom}
                                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                                className="mt-1 border rounded px-2 py-1 w-full"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-600">Valid To (optional)</label>
                            <input
                                type="date"
                                value={form.validTo}
                                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                                className="mt-1 border rounded px-2 py-1 w-full"
                            />
                        </div>
                        <div className="flex items-end justify-end gap-2">
                            {isEditing ? (
                                <button
                                    type="submit"
                                    className="px-3 py-2 bg-amber-600 text-white rounded text-sm"
                                    disabled={saving}
                                >
                                    <Edit className="w-4 h-4 inline-block mr-2" />
                                    Save (create new version)
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="px-3 py-2 bg-primary-600 text-white rounded text-sm"
                                    disabled={saving}
                                >
                                    <PlusCircle className="w-4 h-4 inline-block mr-2" />
                                    Create
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid From</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {taxes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <p className="text-gray-500">No tax rules found</p>
                                    </td>
                                </tr>
                            ) : (
                                taxes.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.countryCode}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.taxClass}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.ratePercent}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.validFrom ? t.validFrom.slice(0, 10) : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.validTo ? t.validTo.slice(0, 10) : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {t.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-2">
                                            {user?.role === 'SuperAdmin' && (
                                                <>
                                                    <button onClick={() => openEdit(t)} className="px-2 py-1 rounded bg-yellow-50 text-amber-700 text-sm inline-flex items-center gap-2">
                                                        <Edit className="w-4 h-4" /> Edit
                                                    </button>
                                                    {t.isActive && (
                                                        <button onClick={() => deactivate(t.id)} className="px-2 py-1 rounded bg-red-50 text-red-700 text-sm inline-flex items-center gap-2">
                                                            <Trash2 className="w-4 h-4" /> Deactivate
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
