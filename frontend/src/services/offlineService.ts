import { PaymentCollectionPayload } from '@/types';
import { paymentService } from './paymentService';

const OFFLINE_PAYMENTS_KEY = 'queued_offline_payments';

export const offlineService = {
  getQueuedPayments(): PaymentCollectionPayload[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(OFFLINE_PAYMENTS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  enqueuePayment(payload: PaymentCollectionPayload): void {
    const queue = this.getQueuedPayments();
    queue.push(payload);
    localStorage.setItem(OFFLINE_PAYMENTS_KEY, JSON.stringify(queue));
  },

  async syncQueuedPayments(): Promise<{ syncedCount: number; errorsCount: number }> {
    const queue = this.getQueuedPayments();
    if (queue.length === 0) return { syncedCount: 0, errorsCount: 0 };

    let syncedCount = 0;
    let errorsCount = 0;
    const remainingQueue: PaymentCollectionPayload[] = [];

    for (const item of queue) {
      try {
        await paymentService.collectPayment(item);
        syncedCount++;
      } catch (err) {
        console.error('Failed to sync offline payment:', item, err);
        errorsCount++;
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(OFFLINE_PAYMENTS_KEY, JSON.stringify(remainingQueue));
    return { syncedCount, errorsCount };
  },
};
