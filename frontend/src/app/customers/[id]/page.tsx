'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Navigation, CreditCard, Clock, ArrowLeft, Zap, Shield, CheckCircle2 } from 'lucide-react';
import { Customer, PaymentRecord } from '@/types';
import { customerService } from '@/services/customerService';
import { paymentService } from '@/services/paymentService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import StatusBadge from '@/components/ui/Badge';
import PaymentModal from '@/components/payments/PaymentModal';
import ReceiptView from '@/components/payments/ReceiptView';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { coords: officerCoords } = useGeolocation();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  const loadData = async () => {
    try {
      const cusData = await customerService.getCustomerById(customerId);
      setCustomer(cusData);

      const payData = await paymentService.getPayments({ customer_id: customerId });
      setPayments(payData);
    } catch (err) {
      console.error('Failed to load customer profile details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) loadData();
  }, [customerId]);

  const handlePaymentSuccess = (record: PaymentRecord) => {
    setIsPaymentModalOpen(false);
    setCompletedPayment(record);
    loadData();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-slate-200 rounded-md w-48"></div>
        <div className="h-64 bg-slate-200 rounded-lg"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p>Consumer record with ID '{customerId}' not found.</p>
        <Link href="/customers" className="text-blue-600 font-semibold underline text-xs mt-2 inline-block">
          Return to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Consumers</span>
      </button>

      {/* Main Profile Header Card */}
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-lg shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={customer.status} priority={customer.priority} />
              {customer.dtc_code && (
                <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1">
                  ⚡ DTC {customer.dtc_code}
                </span>
              )}
              <span className="text-xs text-slate-500 font-medium">Area: {customer.area}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{customer.name}</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Customer ID: <span className="text-slate-800 font-bold">{customer.customer_id}</span> • Assigned Officer:{' '}
              <span className="text-blue-600 font-bold">{customer.assigned_officer_name || 'Unassigned'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="py-2 px-3.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Phone className="w-4 h-4 text-slate-500" />
                <span>Call Consumer</span>
              </a>
            )}
            <Link
              href={`/map?customer_id=${customer.customer_id}&navigate=true`}
              className="py-2.5 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs shadow-md hover:shadow-lg flex items-center gap-2 transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4 fill-white stroke-none" />
              <span>Start Navigation</span>
            </Link>
          </div>
        </div>

        {/* Financial Outstanding Box */}
        <div className="bg-amber-50 p-5 rounded-lg border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-xs text-amber-800 font-bold uppercase tracking-wider">Current Pending Electricity Bill</p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-700">{formatCurrency(customer.pending_amount)}</p>
            <p className="text-xs text-slate-600 mt-0.5">Due Date: {formatDate(customer.due_date)}</p>
          </div>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={customer.status === 'paid'}
            className={`py-2.5 px-5 rounded-md font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm ${
              customer.status === 'paid'
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{customer.status === 'paid' ? 'Bill Paid' : 'Collect Payment Now'}</span>
          </button>
        </div>

        {/* Consumer & Meter Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Consumer Address & Phone */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Consumer Contact Info</h3>
            <div className="flex items-start gap-2 text-xs text-slate-700">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{customer.address}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Phone className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{customer.email}</span>
              </div>
            )}
          </div>

          {/* Meter Details */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Electricity Meter Details</h3>
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Meter Number:</span>
                <span className="font-mono font-bold text-slate-900">{customer.meter_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">DTC Transformer:</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ⚡ {customer.dtc_code || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GIS Coordinates:</span>
                <span className="font-mono text-slate-700">
                  {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Timeline */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-lg shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Previous Payment Collection History
        </h3>

        {payments.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No previous collection transaction records for this consumer.</p>
        ) : (
          <div className="space-y-2.5">
            {payments.map((p) => (
              <div key={p.id} className="bg-slate-50 p-3.5 rounded-md border border-slate-200 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{p.receipt_number}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px] border border-emerald-200">
                      {p.payment_method.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-500">Collected on {formatDate(p.created_at)} by Officer {p.officer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(p.amount)}</p>
                  <p className="text-[10px] text-slate-500">Rem. Balance: {formatCurrency(p.remaining_pending_amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        customer={customer}
        officerCoords={officerCoords}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* Digital Receipt Modal */}
      <ReceiptView
        isOpen={!!completedPayment}
        paymentRecord={completedPayment}
        onClose={() => setCompletedPayment(null)}
      />
    </div>
  );
}
