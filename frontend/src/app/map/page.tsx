'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import MapFilters from '@/components/map/MapFilters';
import PaymentModal from '@/components/payments/PaymentModal';
import ReceiptView from '@/components/payments/ReceiptView';

const MapView = dynamic(
  () => import(/* webpackChunkName: "map-view-clean-v2" */ '@/components/map/MapView'),
  {
    ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">Loading Map...</p>
      </div>
    </div>
  ),
});


import {
  Coordinates,
  Customer,
  MapFilterState,
  MultiRouteCalculationResult,
  PaymentRecord,
} from '@/types';
import { customerService } from '@/services/customerService';
import { routeService } from '@/services/routeService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNavigation } from '@/hooks/useNavigation';
import { useStreetView } from '@/hooks/useStreetView';
import { calculateHaversineDistance } from '@/utils/geo';
import { matchCustomerFilters } from '@/utils/formatters';

import { stopSpeech, setSpeechMuted } from '@/utils/speech';

function MapPageContent() {
  const searchParams = useSearchParams();
  const targetCusId = searchParams.get('customer_id');
  const autoNav = searchParams.get('navigate') === 'true';

  const { coords: officerCoords, heading: officerHeading } = useGeolocation();

  const {
    isNavigating,
    targetCustomer: navTargetCustomer,
    route: activeRoute,
    currentStepIndex,
    isOffRoute,
    isFollowing,
    setRoute: setNavigationRoute,
    startNavigation,
    stopNavigation,
    recalculateRoute,
    updateOfficerPosition,
    toggleFollow,
    disableFollow,
  } = useNavigation({ offRouteThresholdMeters: 75 });

  const { streetView, openStreetView, closeStreetView } = useStreetView();

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Multi-stop Route State
  const [multiRoute, setMultiRoute] = useState<MultiRouteCalculationResult | null>(null);
  const [isMultiNavigating, setIsMultiNavigating] = useState<boolean>(false);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0);
  const [isCalculatingMultiRoute, setIsCalculatingMultiRoute] = useState<boolean>(false);

  // Audio Mute State
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleToggleMute = React.useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      setSpeechMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSpeechMuted(isMuted);
  }, [isMuted]);

  const [filters, setFilters] = useState<MapFilterState>({
    status: 'all',
    overduePeriod: 'all',
    outstandingAmount: 'all',
    dtcCode: 'all',
    searchQuery: '',
  });

  // Payment & Receipt Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  // Load Customers from backend
  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const data = await customerService.getCustomers();

      const safeData = Array.isArray(data) ? data : [];
      setAllCustomers(safeData);

      if (targetCusId) {
        const found = safeData.find((c) => c && c.customer_id === targetCusId);
        if (found) {
          setSelectedCustomer(found);
          if (autoNav && officerCoords) {
            startNavigation(found, officerCoords);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [targetCusId]);

  // Update officer position for navigation & off-route detection
  useEffect(() => {
    if (officerCoords && isNavigating) {
      updateOfficerPosition(officerCoords);
    }
  }, [officerCoords, isNavigating, updateOfficerPosition]);

  // Filter Customers for Map Display
  const filteredCustomers = useMemo(() => {
    return allCustomers.filter((c) => matchCustomerFilters(c, filters));
  }, [allCustomers, filters]);

  // Auto-calculate multi-stop route connecting all filtered customers by default
  const lastMultiRouteOfficerCoordsRef = React.useRef<Coordinates | null>(null);
  const lastFilteredCustomerIdsRef = React.useRef<string>('');

  useEffect(() => {
    if (filteredCustomers.length > 0) {
      const effectiveCoords = officerCoords || { latitude: 21.1458, longitude: 79.0882 };
      const currentIdsKey = filteredCustomers.map((c) => c.customer_id).sort().join(',');
      const filtersChanged = currentIdsKey !== lastFilteredCustomerIdsRef.current;

      // Avoid recalculating multi-route on tiny GPS updates (< 500m movement) unless customer filters changed
      if (!filtersChanged && lastMultiRouteOfficerCoordsRef.current && officerCoords) {
        const distMoved = calculateHaversineDistance(
          lastMultiRouteOfficerCoordsRef.current.latitude,
          lastMultiRouteOfficerCoordsRef.current.longitude,
          officerCoords.latitude,
          officerCoords.longitude
        );
        if (distMoved < 500 && multiRoute !== null) {
          return;
        }
      }

      lastFilteredCustomerIdsRef.current = currentIdsKey;
      lastMultiRouteOfficerCoordsRef.current = effectiveCoords;
      routeService.calculateMultiRoute(effectiveCoords, filteredCustomers)
        .then((res) => {
          setMultiRoute(res);
        })
        .catch((err) => {
          console.warn('Auto multi-route calculation error:', err);
        });
    } else {
      lastFilteredCustomerIdsRef.current = '';
      setMultiRoute(null);
    }
  }, [filteredCustomers, officerCoords]);

  // Count aggregates for filters
  const counts = useMemo(() => {
    return {
      all: allCustomers.length,
      pending: allCustomers.filter((c) => c.status !== 'paid').length,
      overdue: allCustomers.filter((c) => c.status === 'overdue' || c.priority === 'high' || c.priority === 'critical').length,
      paid: allCustomers.filter((c) => c.status === 'paid').length,
    };
  }, [allCustomers]);

  // Distance & Travel Time to selected customer
  const { distanceMeters, durationSeconds } = useMemo(() => {
    if (!selectedCustomer || !officerCoords) return { distanceMeters: undefined, durationSeconds: undefined };
    const dist = calculateHaversineDistance(
      officerCoords.latitude,
      officerCoords.longitude,
      selectedCustomer.latitude,
      selectedCustomer.longitude
    );
    const durSec = (dist * 1.35) / 6.94; // riding speed estimate
    return { distanceMeters: dist, durationSeconds: durSec };
  }, [selectedCustomer, officerCoords]);

  // Navigate Single Customer — starts navigation to a specific customer
  const handleStartSingleNavigation = (customer: Customer) => {
    if (isMultiNavigating) handleStopMultiNavigation();
    setSelectedCustomer(customer);
    const effectiveCoords = officerCoords || { latitude: 21.1458, longitude: 79.0882 };
    startNavigation(customer, effectiveCoords);
  };

  // Navigate All — starts multi-stop route navigation connecting all meters at once
  const handleStartMultiNavigation = async () => {
    if (filteredCustomers.length === 0) return;
    const effectiveCoords = officerCoords || { latitude: 21.1458, longitude: 79.0882 };
    setIsCalculatingMultiRoute(true);
    try {
      const res = await routeService.calculateMultiRoute(effectiveCoords, filteredCustomers);
      setMultiRoute(res);
      setIsMultiNavigating(true);
      setCurrentStopIndex(0);

      if (res.stops && res.stops.length > 0) {
        const firstStopId = res.stops[0].customer_id;
        const firstCust = allCustomers.find((c) => c.customer_id === firstStopId) || filteredCustomers[0];
        setSelectedCustomer(firstCust);
        startNavigation(firstCust, effectiveCoords);
      }
    } catch (err) {
      console.error('Failed to calculate multi-route:', err);
      if (filteredCustomers[0]) {
        startNavigation(filteredCustomers[0], effectiveCoords);
      }
    } finally {
      setIsCalculatingMultiRoute(false);
    }
  };

  const handleStopMultiNavigation = () => {
    setIsMultiNavigating(false);
    setMultiRoute(null);
    setCurrentStopIndex(0);
    stopNavigation();
  };

  const handleSelectStopIndex = (index: number) => {
    if (!multiRoute || !multiRoute.stops[index]) return;
    setCurrentStopIndex(index);
    const stop = multiRoute.stops[index];
    const found = allCustomers.find((c) => c.customer_id === stop.customer_id);
    if (found) {
      setSelectedCustomer(found);
      if (officerCoords) startNavigation(found, officerCoords);
    }
  };

  // Payment Collection Success Callback
  const handlePaymentSuccess = (record: PaymentRecord) => {
    setIsPaymentModalOpen(false);
    setCompletedPayment(record);

    if (isMultiNavigating && multiRoute) {
      if (currentStopIndex < multiRoute.stops.length - 1) {
        handleSelectStopIndex(currentStopIndex + 1);
      } else {
        handleStopMultiNavigation();
      }
    } else {
      stopNavigation();
    }

    // Clear cache and refresh customers to update marker colors instantly
    customerService.clearCache();
    loadCustomers();
  };

  const currentNavStepInstruction = useMemo(() => {
    if (!activeRoute || !activeRoute.steps || activeRoute.steps.length <= currentStepIndex) {
      return undefined;
    }
    return activeRoute.steps[currentStepIndex].instruction;
  }, [activeRoute, currentStepIndex]);

  const navStateObj = useMemo(() => {
    if (!isNavigating || !navTargetCustomer) return undefined;
    return {
      active: true,
      destination: { lat: navTargetCustomer.latitude, lng: navTargetCustomer.longitude },
      targetCustomer: navTargetCustomer,
      distanceMeters: activeRoute?.distance_meters || distanceMeters || 0,
      durationSeconds: activeRoute?.duration_seconds || durationSeconds || 0,
      distanceText: activeRoute?.distance_text || 'Nearby',
      durationText: activeRoute?.duration_text || 'Calculating...',
      currentStepIndex,
      currentStepInstruction: currentNavStepInstruction || `Navigate to meter at ${navTargetCustomer.address}`,
      isOffRoute,
      isFollowing,
    };
  }, [
    isNavigating,
    navTargetCustomer,
    activeRoute,
    distanceMeters,
    durationSeconds,
    currentStepIndex,
    currentNavStepInstruction,
    isOffRoute,
    isFollowing,
  ]);

  const handleSelectMapCustomer = React.useCallback(
    (c: Customer | null) => {
      setSelectedCustomer(c);
      if (c && isMultiNavigating && multiRoute) {
        const stopIdx = multiRoute.stops.findIndex((s) => s.customer_id === c.customer_id);
        if (stopIdx !== -1) setCurrentStopIndex(stopIdx);
      }
    },
    [isMultiNavigating, multiRoute]
  );

  const handleOpenCustomerStreetView = React.useCallback(
    (c: Customer) => {
      openStreetView(c.latitude, c.longitude, c.name, c.address);
    },
    [openStreetView]
  );

  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  const handleCollectPaymentModalOpen = React.useCallback((customer?: Customer) => {
    const target = customer || selectedCustomer || navTargetCustomer;
    if (target) {
      setPaymentCustomer(target);
      setSelectedCustomer(target);
    }
    setIsPaymentModalOpen(true);
  }, [selectedCustomer, navTargetCustomer]);



  const singleNavCustomers = useMemo(() => {
    return navTargetCustomer ? [navTargetCustomer] : [];
  }, [navTargetCustomer]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Top Floating Map Search & Filter Bar (Matching screenshot) */}
      <div className="absolute top-4 left-4 right-4 z-30 max-w-xl mx-auto">
        <MapFilters
          filters={filters}
          onFilterChange={setFilters}
          customers={allCustomers}
          customerCounts={counts}
          selectedCustomer={selectedCustomer}
          onNavigateSelected={
            selectedCustomer ? () => handleStartSingleNavigation(selectedCustomer) : undefined
          }
          onNavigateAll={handleStartMultiNavigation}
          onStopNavigation={handleStopMultiNavigation}
          isNavigating={isNavigating || isMultiNavigating}
          isCalculatingMultiRoute={isCalculatingMultiRoute}
          filteredCount={filteredCustomers.length}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      </div>

      {/* Main Interactive Map Canvas */}
      <div className="flex-1 w-full min-h-0 relative">
        <MapView
          customers={filteredCustomers}
          officerCoords={officerCoords}
          officerHeading={officerHeading}
          selectedCustomer={selectedCustomer}
          route={activeRoute}
          multiRoute={isMultiNavigating ? multiRoute : null}
          activeStopIndex={currentStopIndex}
          navState={navStateObj}
          streetView={streetView}
          onSelectCustomer={handleSelectMapCustomer}
          onExitNavigation={handleStopMultiNavigation}
          onCollectPayment={handleCollectPaymentModalOpen}
          onOpenStreetView={handleOpenCustomerStreetView}
          onCloseStreetView={closeStreetView}
          onToggleFollow={toggleFollow}
          onDisableFollow={disableFollow}
          onDirectionsCalculated={setNavigationRoute}
          onSelectStopIndex={handleSelectStopIndex}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      </div>

      {/* Payment Collection Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        customer={paymentCustomer || selectedCustomer || navTargetCustomer}
        officerCoords={officerCoords}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentCustomer(null);
        }}
        onSuccess={handlePaymentSuccess}
      />

      {/* Digital Receipt View Modal */}
      <ReceiptView
        isOpen={!!completedPayment}
        paymentRecord={completedPayment}
        onClose={() => setCompletedPayment(null)}
      />
    </div>
  );
}

export default function MapPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      }
    >
      <MapPageContent />
    </React.Suspense>
  );
}
