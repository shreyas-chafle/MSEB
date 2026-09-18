'use client';

import React from 'react';

interface MahavitaranLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  variant?: 'full' | 'icon-only' | 'horizontal';
}

export default function MahavitaranLogo({
  className = '',
  size = 'md',
  showSubtitle = true,
  variant = 'full',
}: MahavitaranLogoProps) {
  const sizeMap = {
    sm: { symbol: 'w-7 h-7', text: 'text-sm', sub: 'text-[8px]', gap: 'gap-2' },
    md: { symbol: 'w-10 h-10', text: 'text-xl', sub: 'text-[10px]', gap: 'gap-3' },
    lg: { symbol: 'w-16 h-16', text: 'text-3xl', sub: 'text-xs', gap: 'gap-4' },
  };

  const currentSize = sizeMap[size];

  // Exact Mahavitaran Twin Red Lightning Peak Symbol
  const LightningSymbol = (
    <svg
      className={`${currentSize.symbol} shrink-0`}
      viewBox="0 0 120 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left Red Lightning Bolt */}
      <path
        d="M60 4L18 42H40L8 85H31L48 50L60 4Z"
        fill="#D9232A"
      />
      {/* Right Red Lightning Bolt */}
      <path
        d="M60 4L102 42H80L112 85H89L72 50L60 4Z"
        fill="#D9232A"
      />
    </svg>
  );

  if (variant === 'icon-only') {
    return <div className={`inline-flex items-center ${className}`}>{LightningSymbol}</div>;
  }

  return (
    <div className={`inline-flex items-center ${currentSize.gap} ${className} select-none`}>
      {LightningSymbol}
      <div className="flex flex-col leading-none">
        <div className={`font-black tracking-tight font-sans ${currentSize.text} flex items-center`}>
          <span className="text-slate-950 font-black">MAHA</span>
          <span className="text-slate-500 font-medium">VITARAN</span>
        </div>
        {showSubtitle && (
          <span className={`text-slate-500 font-semibold tracking-normal mt-1 ${currentSize.sub}`}>
            Maharashtra State Electricity Distribution Co. Ltd.
          </span>
        )}
      </div>
    </div>
  );
}
