'use client';

import { useState, useEffect } from 'react';
import { offlineService } from '@/services/offlineService';

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    setQueuedCount(offlineService.getQueuedPayments().length);

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      const res = await offlineService.syncQueuedPayments();
      setQueuedCount(offlineService.getQueuedPayments().length);
      setIsSyncing(false);
      if (res.syncedCount > 0) {
        window.dispatchEvent(new Event('offline-payments-synced'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshQueueCount = () => {
    setQueuedCount(offlineService.getQueuedPayments().length);
  };

  return { isOnline, queuedCount, isSyncing, refreshQueueCount };
}
