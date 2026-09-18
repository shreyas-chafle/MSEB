'use client';

import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Customer, PaymentRecord } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { paymentService } from '@/services/paymentService';
import { offlineService } from '@/services/offlineService';
import { useOffline } from '@/hooks/useOffline';

interface PaymentModalProps {
  isOpen: boolean;
  customer: Customer | null;
  officerCoords?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSuccess: (paymentRecord: PaymentRecord) => void;
}

export default function PaymentModal({
  isOpen,
  customer,
  officerCoords,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { isOnline, refreshQueueCount } = useOffline();

  const [collectedAmount, setCollectedAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi_online' | 'cheque' | 'other'>('cash');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill collected amount with customer's pending amount by default
  React.useEffect(() => {
    if (customer && isOpen) {
      setCollectedAmount(customer.pending_amount.toString());
      setError(null);
      setRemarks('');
    }
  }, [customer?.customer_id, customer?.pending_amount, isOpen]);

  if (!customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(collectedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid collection amount greater than 0.');
      return;
    }

    if (amt > customer.pending_amount) {
      setError(`Collected amount (\u20b9${amt}) cannot exceed pending amount (\u20b9${customer.pending_amount}).`);
      return;
    }

    setIsSubmitting(true);

    // Map UI payment method values to backend-accepted values
    const backendPaymentMethod: string =
      paymentMethod === 'upi_online' ? 'upi' : paymentMethod;

    const payload = {
      customer_id: customer.customer_id,
      meter_id: customer.meters?.[0]?.meter_id,
      amount: amt,
      payment_method: backendPaymentMethod,
      remarks: remarks.trim() || undefined,
      collection_latitude: officerCoords?.latitude,
      collection_longitude: officerCoords?.longitude,
    };

    try {
      if (!isOnline) {
        // Enqueue payment locally when offline
        offlineService.enqueuePayment(payload);
        refreshQueueCount();
        
        // Construct offline placeholder payment record for immediate receipt display
        const offlineRecord: PaymentRecord = {
          id: `OFFLINE-${Date.now()}`,
          receipt_number: `REC-OFFLINE-${Math.floor(Math.random() * 900000 + 100000)}`,
          payment_id: `PAY-OFFLINE`,
          customer_id: customer.customer_id,
          customer_name: customer.name,
          meter_number: customer.meter_number,
          officer_id: customer.assigned_officer_id || 'OFF-1001',
          officer_name: 'Field Officer (Offline Queue)',
          amount: amt,
          payment_method: paymentMethod === 'upi_online' ? 'UPI/ONLINE' : paymentMethod.toUpperCase(),
          remarks: remarks || 'Collected in offline mode',
          previous_pending_amount: customer.pending_amount,
          remaining_pending_amount: Math.max(0, customer.pending_amount - amt),
          bill_status: customer.pending_amount - amt <= 0 ? 'paid' : 'partially_paid',
          created_at: new Date().toISOString(),
        };

        setIsSubmitting(false);
        onSuccess(offlineRecord);
        return;
      }

      // Online collection via FastAPI backend — send backend-mapped method
      const result = await paymentService.collectPayment({ ...payload, payment_method: backendPaymentMethod });

      setIsSubmitting(false);
      onSuccess(result);
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err.response?.data?.detail || err.message || 'Failed to process payment collection.';
      setError(msg);
    }
  };

  const paymentMethodsList = [
    { key: 'cash', label: 'CASH' },
    { key: 'upi_online', label: 'UPI/ONLINE' },
    { key: 'cheque', label: 'CHEQUE' },
    { key: 'other', label: 'OTHER' },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Electricity Bill">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Customer Summary Banner */}
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-slate-900 text-sm">{customer.name}</p>
              <p className="text-slate-500">
                Customer ID: <span className="text-slate-800 font-semibold">{customer.customer_id}</span>
              </p>
            </div>
            <span className="text-amber-700 font-bold text-base">{formatCurrency(customer.pending_amount)}</span>
          </div>
          <p className="text-slate-500">
            Meter #: <span className="text-slate-800 font-semibold">{customer.meter_number}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-2.5 rounded-md border border-red-200 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Amount Collected Input */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Amount Collected (₹) *</label>
          <input
            type="number"
            step="0.01"
            value={collectedAmount}
            onChange={(e) => setCollectedAmount(e.target.value)}
            placeholder="Enter collected amount"
            className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-base rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Payment Method *</label>
          <div className="grid grid-cols-4 gap-2">
            {paymentMethodsList.map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setPaymentMethod(method.key)}
                className={`py-2 px-1 rounded-md font-extrabold text-[11px] uppercase transition-colors border cursor-pointer ${
                  paymentMethod === method.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Remarks Input */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Remarks / Notes</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional collection note"
            className="w-full bg-white border border-slate-300 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Submit & Confirm Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing Collection...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Generate Receipt</span>
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
