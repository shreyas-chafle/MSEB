'use client';

import React from 'react';
import { getMarkerStatusColor } from '@/utils/geo';

interface StatusBadgeProps {
  status: string;
  priority?: string;
  text?: string;
}

export default function StatusBadge({ status, priority, text }: StatusBadgeProps) {
  const { badgeClass } = getMarkerStatusColor(status, priority);
  const label = text || status.replace('_', ' ').toUpperCase();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
      {label}
    </span>
  );
}
