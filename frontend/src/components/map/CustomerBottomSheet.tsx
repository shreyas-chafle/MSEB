'use client';

import { Customer } from '@/types';

interface CustomerBottomSheetProps {
  customer: Customer | null;
  officerCoords?: { latitude: number; longitude: number } | null;
  distanceMeters?: number;
  durationSeconds?: number;
  onClose: () => void;
  onNavigate: (customer: Customer) => void;
  onCollectPayment: (customer: Customer) => void;
  onViewStreetView?: (customer: Customer) => void;
}

// Component completely removed per user request
export default function CustomerBottomSheet({}: CustomerBottomSheetProps) {
  return null;
}
