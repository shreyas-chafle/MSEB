import api from './api';
import { PaymentCollectionPayload, PaymentRecord, DigitalReceipt } from '@/types';

export const paymentService = {
  async collectPayment(payload: PaymentCollectionPayload): Promise<PaymentRecord> {
    const response = await api.post<PaymentRecord>('/api/payments/collect', payload);
    return response.data;
  },

  async getPayments(params?: { customer_id?: string; officer_id?: string }): Promise<PaymentRecord[]> {
    const response = await api.get<PaymentRecord[]>('/api/payments', { params });
    return response.data;
  },

  async getReceipt(paymentIdOrReceipt: string): Promise<DigitalReceipt> {
    const response = await api.get<DigitalReceipt>(`/api/payments/${paymentIdOrReceipt}/receipt`);
    return response.data;
  },
};
