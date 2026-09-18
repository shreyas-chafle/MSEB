'use client';

import React, { useEffect, useState } from 'react';
import { X, Search, Users, Gauge, DollarSign, AlertCircle } from 'lucide-react';
import { Customer } from '@/types';
import { customerService } from '@/services/customerService';
import { formatCurrency } from '@/utils/formatters';

interface AssignedCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: string;
}

export default function AssignedCustomersModal({ isOpen, onClose, initialFilter = '' }: AssignedCustomersModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);

  useEffect(() => {
    if (isOpen) {
      setStatusFilter(initialFilter);
    }
  }, [isOpen, initialFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAssigned = async () => {
      setLoading(true);
      try {
        const data = await customerService.getCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to load assigned customers', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssigned();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter customers based on search query & card mode (Assigned, Pending, or Paid/Completed)
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(search.toLowerCase()) ||
      c.meter_number.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'pending') {
      return c.pending_amount > 0 || c.status !== 'paid';
    }

    if (statusFilter === 'paid') {
      return c.status === 'paid' || c.pending_amount <= 0;
    }

    // Default '' mode: Show all assigned customers
    return true;
  });

  const totalPendingSum = customers.reduce((acc, c) => acc + (c.pending_amount || 0), 0);
  const pendingCount = customers.filter((c) => c.pending_amount > 0).length;

  const modalTitle =
    statusFilter === 'pending'
      ? 'Pending Customers Directory'
      : statusFilter === 'paid'
      ? 'Completed Collections'
      : 'Assigned Customers Directory';

  const modalHeaderBg =
    statusFilter === 'pending'
      ? 'bg-red-600'
      : statusFilter === 'paid'
      ? 'bg-emerald-600'
      : 'bg-blue-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg text-white shadow-xs ${modalHeaderBg}`}>
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-none">{modalTitle}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Strip */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-5 py-2.5 grid grid-cols-3 gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Total Assigned: </span>
              <span className="font-bold text-slate-900">{customers.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Total Outstanding: </span>
              <span className="font-bold text-amber-600">{formatCurrency(totalPendingSum)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Pending Dues: </span>
              <span className="font-bold text-slate-900">{pendingCount} accounts</span>
            </div>
          </div>
        </div>

        {/* Controls: Search */}
        <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Meter ID, Consumer Name, Customer ID..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 custom-scrollbar">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs space-y-2">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-medium">Loading assigned consumer accounts...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-lg shadow-2xs">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No consumer records match your search.</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Try adjusting your search filters above.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto custom-scrollbar shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Meter ID / Number</th>
                    <th className="py-3 px-4">Consumer Name</th>
                    <th className="py-3 px-4 text-right">Pending Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredCustomers.map((cus, idx) => (
                    <tr key={cus.customer_id} className="hover:bg-blue-50/50 transition-colors">
                      {/* Index */}
                      <td className="py-3 px-4 font-semibold text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Meter ID / Meter Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <Gauge className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs block">
                              {cus.meter_number}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: {cus.meters?.[0]?.meter_id || `MTR-${cus.customer_id.slice(-5)}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Consumer Name */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{cus.name}</p>
                          <p className="text-[11px] text-slate-500">
                            CUS ID: <span className="font-medium text-slate-700">{cus.customer_id}</span>
                            {cus.area && <span> • {cus.area}</span>}
                          </p>
                        </div>
                      </td>

                      {/* Pending Amount */}
                      <td className="py-3 px-4 text-right font-extrabold text-sm">
                        {cus.pending_amount > 0 ? (
                          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {formatCurrency(cus.pending_amount)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ₹ 0.00
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Showing {filteredCustomers.length} of {customers.length} consumers</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
