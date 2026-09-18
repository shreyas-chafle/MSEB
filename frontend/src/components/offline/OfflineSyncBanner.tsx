'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';

export default function OfflineSyncBanner() {
  const { isOnline, queuedCount, isSyncing } = useOffline();

  if (isOnline && queuedCount === 0 && !isSyncing) return null;

  return (
    <div
      className={`px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
        !isOnline
          ? 'bg-rose-600 text-white'
          : isSyncing
          ? 'bg-amber-600 text-white'
          : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-center">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>You are offline. Collections will be saved locally & synced automatically once reconnected.</span>
            {queuedCount > 0 && (
              <span className="bg-rose-800 px-2 py-0.5 rounded-full text-[10px] border border-rose-400">
                {queuedCount} Queued
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Synchronizing queued offline payments with server...</span>
          </>
        ) : (
          <span>Connected back online. Offline payments synced!</span>
        )}
      </div>
    </div>
  );
}
