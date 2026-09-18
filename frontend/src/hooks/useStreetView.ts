'use client';

import { useState, useCallback } from 'react';
import { StreetViewState } from '@/types';
import { checkStreetViewAvailability } from '@/services/streetViewService';

export function useStreetView() {
  const [streetView, setStreetView] = useState<StreetViewState>({
    isOpen: false,
    isAvailable: false,
    isChecking: false,
    lat: 0,
    lng: 0,
    heading: 0,
    pitch: 0,
    customerName: '',
    address: '',
  });

  const openStreetView = useCallback(async (lat: number, lng: number, customerName?: string, address?: string) => {
    setStreetView({
      isOpen: true,
      isAvailable: false,
      isChecking: true,
      lat,
      lng,
      heading: 0,
      pitch: 0,
      customerName,
      address,
    });

    const result = await checkStreetViewAvailability(lat, lng, 60);

    setStreetView((prev) => ({
      ...prev,
      isChecking: false,
      isAvailable: result.available,
      lat: result.lat || lat,
      lng: result.lng || lng,
    }));
  }, []);

  const closeStreetView = useCallback(() => {
    setStreetView((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    streetView,
    openStreetView,
    closeStreetView,
  };
}
