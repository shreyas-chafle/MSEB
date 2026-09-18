'use client';

import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { customerService } from '@/services/customerService';
import { Customer } from '@/types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCustomerModal({ isOpen, onClose, onSuccess }: AddCustomerModalProps) {
  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    area: 'Central Area',
    meter_number: '',
    dtc_code: '7865785',
    pending_amount: '0',
    due_date: new Date().toISOString().split('T')[0],
    latitude: '21.1458',
    longitude: '79.0882',
    status: 'pending',
    priority: 'normal',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.name || !formData.meter_number) {
      setError('Please fill in Customer ID, Name, and Meter Number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: Partial<Customer> = {
        customer_id: formData.customer_id.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim() || '+91 9822000000',
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || 'Nagpur Central Sector',
        area: formData.area.trim() || 'Central Area',
        meter_number: formData.meter_number.trim(),
        dtc_code: formData.dtc_code.trim() || '7865785',
        pending_amount: parseFloat(formData.pending_amount) || 0,
        due_date: formData.due_date || undefined,
        latitude: parseFloat(formData.latitude) || 21.1458,
        longitude: parseFloat(formData.longitude) || 79.0882,
        status: formData.status as any,
        priority: formData.priority as any,
      };

      await customerService.createCustomer(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create customer', err);
      setError(err?.response?.data?.detail || 'Failed to save customer to database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Add New Consumer Account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer ID *</label>
              <input
                type="text"
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                placeholder="e.g. CUS-9001"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Meter Number *</label>
              <input
                type="text"
                required
                value={formData.meter_number}
                onChange={(e) => setFormData({ ...formData, meter_number: e.target.value })}
                placeholder="e.g. MTR-9001"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">DTC Code (7-Digit) *</label>
              <input
                type="text"
                required
                maxLength={7}
                value={formData.dtc_code}
                onChange={(e) => setFormData({ ...formData, dtc_code: e.target.value })}
                placeholder="e.g. 7865785"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Consumer Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar Patel"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 9822000000"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Area / Ward</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="e.g. Dharampeth"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Premises Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Plot 15, High Court Road"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pending Amount (₹)</label>
              <input
                type="number"
                step="any"
                value={formData.pending_amount}
                onChange={(e) => setFormData({ ...formData, pending_amount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-bold text-amber-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Save to Database</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
