'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Customer, Coordinates, RouteCalculationResult } from '@/types';
import { calculateHaversineDistance } from '@/utils/geo';
import { routeService } from '@/services/routeService';

interface UseNavigationOptions {
  offRouteThresholdMeters?: number;
}

export function useNavigation(options: UseNavigationOptions = {}) {
  const { offRouteThresholdMeters = 80 } = options;

  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [targetCustomer, setTargetCustomer] = useState<Customer | null>(null);
  const [route, setRoute] = useState<RouteCalculationResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isOffRoute, setIsOffRoute] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);

  const lastRerouteTimeRef = useRef<number>(0);

  // Start Navigation to a target consumer
  const startNavigation = useCallback(
    async (customer: Customer, officerCoords: Coordinates | null) => {
      setTargetCustomer(customer);
      setIsNavigating(true);
      setIsFollowing(true);
      setCurrentStepIndex(0);
      setIsOffRoute(false);

      if (!officerCoords) return;

      setIsCalculatingRoute(true);
      try {
        const calculatedRoute = await routeService.calculateRoute(officerCoords, {
          latitude: customer.latitude,
          longitude: customer.longitude,
        });
        setRoute(calculatedRoute);
      } catch (err) {
        console.error('Failed to calculate route for navigation:', err);
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    []
  );

  // Stop / Exit Navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setTargetCustomer(null);
    setRoute(null);
    setCurrentStepIndex(0);
    setIsOffRoute(false);
    setIsFollowing(false);
  }, []);

  // Recalculate route (manual or automatic off-route trigger)
  const recalculateRoute = useCallback(
    async (officerCoords: Coordinates) => {
      if (!targetCustomer) return;
      const now = Date.now();
      if (now - lastRerouteTimeRef.current < 5000) return; // Debounce: 5s between reroutes

      lastRerouteTimeRef.current = now;
      setIsCalculatingRoute(true);
      try {
        const newRoute = await routeService.calculateRoute(officerCoords, {
          latitude: targetCustomer.latitude,
          longitude: targetCustomer.longitude,
        });
        setRoute(newRoute);
        setIsOffRoute(false);
      } catch (err) {
        console.error('Failed to recalculate off-route path:', err);
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    [targetCustomer]
  );

  // Check off-route status as officer moves
  const updateOfficerPosition = useCallback(
    (officerCoords: Coordinates) => {
      if (!isNavigating || !targetCustomer) return;

      // Check distance to the destination
      const distToDest = calculateHaversineDistance(
        officerCoords.latitude,
        officerCoords.longitude,
        targetCustomer.latitude,
        targetCustomer.longitude
      );

      // If route has path coordinates, use those for off-route check
      let minDistToRoute = distToDest;
      if (route?.coordinates_path && route.coordinates_path.length > 0) {
        minDistToRoute = Infinity;
        route.coordinates_path.forEach((pt) => {
          const d = calculateHaversineDistance(
            officerCoords.latitude, officerCoords.longitude,
            pt.latitude, pt.longitude
          );
          if (d < minDistToRoute) minDistToRoute = d;
        });
      }

      // Advance step when close to step end location
      if (route?.steps && route.steps.length > currentStepIndex) {
        const step = route.steps[currentStepIndex];
        if (step.end_location) {
          const distToStep = calculateHaversineDistance(
            officerCoords.latitude, officerCoords.longitude,
            step.end_location.latitude, step.end_location.longitude
          );
          if (distToStep < 30 && currentStepIndex < route.steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
          }
        }
      }

      // Off-route check — only trigger if we have a route path to compare against
      if (route?.coordinates_path && route.coordinates_path.length > 0) {
        if (minDistToRoute > offRouteThresholdMeters) {
          setIsOffRoute(true);
          recalculateRoute(officerCoords);
        } else {
          setIsOffRoute(false);
        }
      }
    },
    [isNavigating, targetCustomer, route, currentStepIndex, offRouteThresholdMeters, recalculateRoute]
  );

  const toggleFollow = useCallback(() => {
    setIsFollowing((prev) => !prev);
  }, []);

  const disableFollow = useCallback(() => {
    setIsFollowing(false);
  }, []);

  return {
    isNavigating,
    targetCustomer,
    route,
    currentStepIndex,
    isOffRoute,
    isFollowing,
    setRoute,
    startNavigation,
    stopNavigation,
    recalculateRoute,
    updateOfficerPosition,
    toggleFollow,
    disableFollow,
    setIsFollowing,
  };
}
