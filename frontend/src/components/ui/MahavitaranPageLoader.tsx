'use client';

import React from 'react';
import MahavitaranLogo from './MahavitaranLogo';

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export default function MahavitaranPageLoader({
  message = 'Loading...',
  fullScreen = true,
}: PageLoaderProps) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-50/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-slate-800 animate-fade-in'
    : 'w-full py-12 flex flex-col items-center justify-center p-6 text-slate-800 animate-fade-in';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center max-w-xs w-full space-y-4 text-center">
        {/* Subtle Logo Container with Outer Animated Spinner Ring */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-slate-200 border-t-blue-600 border-r-blue-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <MahavitaranLogo size="sm" showSubtitle={false} variant="icon-only" />
          </div>
        </div>

        {/* Status Message */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700 tracking-wide">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

