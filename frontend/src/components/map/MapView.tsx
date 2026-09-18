'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Customer,
  Coordinates,
  RouteCalculationResult,
  MultiRouteCalculationResult,
  MapLayerType,
  NavigationState,
  StreetViewState,
} from '@/types';
import { createOfficerMarkerIcon } from '@/components/map/OfficerMarker';
import { createConsumerMarkerIcon } from '@/components/map/ConsumerMarker';
import MapControls from '@/components/map/MapControls';
import NavigationPanel from '@/components/map/NavigationPanel';
import StreetViewModal from '@/components/map/StreetViewModal';
import {
  speakText,
  speakInstruction,
  stopSpeech,
  enableVoiceAudio,
  announceCustomerInfo,
  parseManeuverSpeech,
} from '@/utils/speech';

interface MapViewProps {
  customers: Customer[];
  officerCoords: Coordinates | null;
  officerHeading?: number | null;
  selectedCustomer: Customer | null;
  route: RouteCalculationResult | null;
  multiRoute?: MultiRouteCalculationResult | null;
  activeStopIndex?: number;
  navState?: NavigationState;
  streetView?: StreetViewState;
  onSelectCustomer: (customer: Customer | null) => void;
  onExitNavigation?: () => void;
  onCollectPayment?: (customer?: Customer) => void;
  onOpenStreetView?: (customer: Customer) => void;
  onCloseStreetView?: () => void;
  onToggleFollow?: () => void;
  onDisableFollow?: () => void;
  onDirectionsCalculated?: (result: RouteCalculationResult) => void;
  onSelectStopIndex?: (index: number) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

// Tile Layer Configuration for Leaflet
const TILE_LAYERS: Record<MapLayerType, { url: string; attribution: string; maxZoom: number }> = {
  roadmap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; World Imagery',
    maxZoom: 19,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
  },
};

// Direct OSRM Street Route Fetcher (Fallback / Secondary Engine)
async function fetchOSRMPath(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  steps: { instruction: string; distance_text: string; duration_text: string }[];
} | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route0 = data.routes[0];
        const geoCoords = route0.geometry?.coordinates || [];
        const coordinates: Coordinates[] = geoCoords.map((pt: [number, number]) => ({
          latitude: pt[1],
          longitude: pt[0],
        }));

        const rawSteps = route0.legs?.[0]?.steps || [];
        const steps = rawSteps.map((s: any) => {
          const maneuver = s.maneuver?.type || '';
          const modifier = s.maneuver?.modifier || '';
          const name = s.name || '';
          const distM = Math.round(s.distance || 0);
          const durSec = Math.round(s.duration || 0);
          const instruction = parseManeuverSpeech(maneuver, modifier, name, distM);
          const distance_text = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`;
          const duration_text = durSec >= 60 ? `${Math.round(durSec / 60)} min` : `${durSec} s`;

          return { instruction, distance_text, duration_text };
        });

        return {
          coordinates,
          distanceMeters: Math.round(route0.distance || 0),
          durationSeconds: Math.round(route0.duration || 0),
          steps: steps.length > 0 ? steps : [
            {
              instruction: 'Proceed along route towards electricity meter',
              distance_text: `${Math.round(route0.distance || 0)} m`,
              duration_text: `${Math.round((route0.duration || 0) / 60)} min`,
            }
          ],
        };
      }
    }
  } catch (e) {
    console.warn('OSRM path fetch error:', e);
  }
  return null;
}

export default function MapView({
  customers,
  officerCoords,
  officerHeading = null,
  selectedCustomer,
  route,
  multiRoute,
  activeStopIndex = 0,
  navState,
  streetView,
  onSelectCustomer,
  onExitNavigation,
  onCollectPayment,
  onOpenStreetView,
  onCloseStreetView,
  onToggleFollow,
  onDisableFollow,
  onDirectionsCalculated,
  onSelectStopIndex,
  isMuted: isMutedProp,
  onToggleMute: onToggleMuteProp,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Leaflet references
  const leafletInstanceRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const officerMarkerRef = useRef<any>(null);
  const customerMarkersRef = useRef<Map<string, any>>(new Map());
  const multiRoutePolylineRef = useRef<any>(null);
  const singleRoutePolylineRef = useRef<any>(null);
  const routingControlRef = useRef<any>(null);

  // Interaction and cache tracking refs
  const lastDirectionsKeyRef = useRef<string>('');
  const lastFittedMultiRouteRef = useRef<string>('');
  const userHasInteractedRef = useRef<boolean>(false);
  const isProgrammaticZoomRef = useRef<boolean>(false);
  const prevSpokenStepIndexRef = useRef<number>(-1);

  // Component State
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('roadmap');
  const [isFollowingInternal, setIsFollowingInternal] = useState<boolean>(false);
  const [is3D, setIs3D] = useState<boolean>(false);
  const [isMutedInternal, setIsMutedInternal] = useState<boolean>(false);

  const isMuted = isMutedProp !== undefined ? isMutedProp : isMutedInternal;
  const isFollowing = navState?.isFollowing ?? isFollowingInternal;

  // Stable callback refs
  const customersRef = useRef(customers);
  customersRef.current = customers;
  const officerCoordsRef = useRef(officerCoords);
  officerCoordsRef.current = officerCoords;
  const onSelectCustomerRef = useRef(onSelectCustomer);
  onSelectCustomerRef.current = onSelectCustomer;
  const onCollectPaymentRef = useRef(onCollectPayment);
  onCollectPaymentRef.current = onCollectPayment;
  const onToggleFollowRef = useRef(onToggleFollow);
  onToggleFollowRef.current = onToggleFollow;
  const onDisableFollowRef = useRef(onDisableFollow);
  onDisableFollowRef.current = onDisableFollow;
  const onDirectionsCalculatedRef = useRef(onDirectionsCalculated);
  onDirectionsCalculatedRef.current = onDirectionsCalculated;

  // ── Global fast-path zero-latency payment collection trigger ───────────────
  useEffect(() => {
    (window as any).__handleCollectPayment = (customerId: string, e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if ((e as any).stopImmediatePropagation) {
          (e as any).stopImmediatePropagation();
        }
      }

      // Close the Leaflet popup immediately for instant visual response
      if (mapRef.current) {
        try {
          mapRef.current.closePopup();
        } catch {}
      }

      const found = customersRef.current.find((c) => c.customer_id === customerId);
      if (found && onCollectPaymentRef.current) {
        onCollectPaymentRef.current(found);
      }
    };

    return () => {
      delete (window as any).__handleCollectPayment;
    };
  }, []);

  // ── Capture-phase click listener to bypass Leaflet map drag/tap delays ────
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;
    const container = map.getContainer();
    if (!container) return;

    const handleAction = (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target?.closest?.('[data-collect-customer-id]') as HTMLElement;
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if ((e as any).stopImmediatePropagation) {
          (e as any).stopImmediatePropagation();
        }
        const cid = btn.getAttribute('data-collect-customer-id');
        if (cid && (window as any).__handleCollectPayment) {
          (window as any).__handleCollectPayment(cid, e);
        }
      }
    };

    const handlePointerDown = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('[data-collect-customer-id]')) {
        // Prevent Leaflet map from starting pan/drag or swallowing click
        e.stopPropagation();
      }
    };

    // Capture phase (true) intercepts user tap/click before Leaflet map listeners
    container.addEventListener('pointerdown', handlePointerDown, true);
    container.addEventListener('mousedown', handlePointerDown, true);
    container.addEventListener('touchstart', handlePointerDown, { capture: true, passive: true });
    container.addEventListener('click', handleAction, true);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('mousedown', handlePointerDown, true);
      container.removeEventListener('touchstart', handlePointerDown, true);
      container.removeEventListener('click', handleAction, true);
    };
  }, [isMapReady]);

  const handleToggleMute = () => {
    enableVoiceAudio(false);
    if (onToggleMuteProp) {
      onToggleMuteProp();
    } else {
      setIsMutedInternal((prev) => {
        const next = !prev;
        if (next) {
          stopSpeech();
        } else {
          speakText('Voice navigation enabled.', { isMuted: false, urgent: true, playChime: true });
        }
        return next;
      });
    }
  };

  const disableFollowMode = useCallback(() => {
    if (onDisableFollowRef.current) {
      onDisableFollowRef.current();
    }
    setIsFollowingInternal(false);
  }, []);

  // ── Auto follow on navigation start/stop ────────────────────────────────────
  useEffect(() => {
    if (navState?.active) {
      setIsFollowingInternal(true);
      if (navState.targetCustomer) {
        enableVoiceAudio();
        speakText(`Starting route to customer ${navState.targetCustomer.name}. Meter: ${navState.targetCustomer.meter_number || 'unassigned'}`, {
          isMuted,
          urgent: true,
        });
      }
    } else {
      setIsFollowingInternal(false);
      prevSpokenStepIndexRef.current = -1;
    }
  }, [navState?.active, navState?.targetCustomer?.customer_id]);

  // ── Announce Step Advancement & Arrival ───────────────────────────────────────
  useEffect(() => {
    if (!navState?.active) return;

    // Check Destination Arrival (< 25 meters)
    if (navState.distanceMeters !== undefined && navState.distanceMeters > 0 && navState.distanceMeters <= 25) {
      speakText('You have reached the destination electricity meter.', { isMuted, urgent: true });
      return;
    }

    // Step Advancement Voice Instructions
    if (
      navState.currentStepInstruction &&
      navState.currentStepIndex !== prevSpokenStepIndexRef.current
    ) {
      prevSpokenStepIndexRef.current = navState.currentStepIndex;
      speakText(navState.currentStepInstruction, { isMuted, urgent: true });
    }
  }, [
    navState?.active,
    navState?.currentStepIndex,
    navState?.currentStepInstruction,
    navState?.distanceMeters,
    isMuted,
  ]);

  // ── 1. Initialize Leaflet Map & Leaflet Routing Machine ───────────────────────
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      const LModule = await import('leaflet');
      const L = LModule.default || LModule;
      (window as any).L = L;

      // Load Leaflet Routing Machine plugin
      try {
        await import('leaflet-routing-machine');
      } catch (err) {
        console.warn('Leaflet routing machine plugin loading warning:', err);
      }

      leafletInstanceRef.current = L;

      if (!isMounted || !mapContainerRef.current || mapRef.current) return;

      const centerLat = officerCoordsRef.current?.latitude || 21.1458;
      const centerLng = officerCoordsRef.current?.longitude || 79.0882;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });

      const layerConfig = TILE_LAYERS.roadmap;
      const tileLayer = L.tileLayer(layerConfig.url, {
        attribution: layerConfig.attribution,
        maxZoom: layerConfig.maxZoom,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapRef.current = map;

      // User interaction listener: disable auto-follow on manual pan or zoom
      map.on('click', () => {
        enableVoiceAudio(false);
      });

      map.on('dragstart', () => {
        userHasInteractedRef.current = true;
        disableFollowMode();
      });

      map.on('zoomstart', () => {
        if (isProgrammaticZoomRef.current) {
          isProgrammaticZoomRef.current = false;
          return;
        }
        userHasInteractedRef.current = true;
        disableFollowMode();
      });

      setIsMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (routingControlRef.current) {
        try {
          routingControlRef.current.remove();
        } catch {}
        routingControlRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [disableFollowMode]);

  // ── 2. Officer GPS Marker + Follow-Me Camera ─────────────────────────────────
  useEffect(() => {
    const L = leafletInstanceRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map || !officerCoords) return;

    const pos: [number, number] = [officerCoords.latitude, officerCoords.longitude];
    const icon = createOfficerMarkerIcon(L, officerHeading);

    if (!officerMarkerRef.current) {
      const marker = L.marker(pos, {
        icon: icon || undefined,
        title: 'You (Field Officer)',
        zIndexOffset: 1000,
      }).addTo(map);
      officerMarkerRef.current = marker;
    } else {
      officerMarkerRef.current.setLatLng(pos);
      if (icon) {
        officerMarkerRef.current.setIcon(icon);
      }
    }

    // Auto-follow officer location
    if (isFollowing) {
      map.panTo(pos, { animate: true });
    }
  }, [isMapReady, officerCoords, officerHeading, isFollowing]);

  // ── 3. Customer Markers & Popups + Marker Click Voice Announcements ──────────
  useEffect(() => {
    const L = leafletInstanceRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;

    const currentCustomerIds = new Set(customers.map((c) => c.customer_id));

    // Remove stale markers
    customerMarkersRef.current.forEach((marker, id) => {
      if (!currentCustomerIds.has(id)) {
        marker.remove();
        customerMarkersRef.current.delete(id);
      }
    });

    customers.forEach((customer) => {
      const isSelected = selectedCustomer?.customer_id === customer.customer_id;
      const multiStop = multiRoute?.stops?.find((s) => s.customer_id === customer.customer_id);
      const isCurrentStop = multiStop && (multiStop.sequence - 1) === activeStopIndex;

      const icon = createConsumerMarkerIcon(
        L,
        customer.status,
        customer.priority,
        isSelected || !!isCurrentStop,
        multiStop?.sequence,
        customer.meter_number
      );

      const pos: [number, number] = [customer.latitude, customer.longitude];
      let marker = customerMarkersRef.current.get(customer.customer_id);

      const popupHtml = `
        <div style="padding: 2px 4px; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; min-width: 190px; max-width: 220px; box-sizing: border-box;">
          <div style="padding-right: 16px; margin-bottom: 2px;">
            <h4 style="margin: 0; font-weight: 800; font-size: 12px; color: #0f172a; line-height: 1.2;">${customer.name}</h4>
            <p style="margin: 2px 0 0; font-size: 10.5px; color: #64748b; font-weight: 600;">
              Meter: <span style="color: #0284c7; font-weight: 800; font-family: monospace;">${customer.meter_number}</span>
              ${customer.dtc_code ? ` &bull; DTC: <span style="color: #d97706; font-weight: 800; font-family: monospace;">${customer.dtc_code}</span>` : ''}
            </p>
          </div>

          <div style="margin: 4px 0 6px; padding: 4px 8px; background: #fffbebf5; border: 1px solid #fde68a; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 9.5px; color: #b45309; font-weight: 800; text-transform: uppercase;">Amt for Pay Now</span>
            <span style="font-size: 12.5px; font-weight: 900; color: #d97706;">&#8377;${customer.pending_amount.toLocaleString('en-IN')}</span>
          </div>

          <button
            type="button"
            id="map-info-collect-btn-${customer.customer_id}"
            data-collect-customer-id="${customer.customer_id}"
            onclick="window.__handleCollectPayment && window.__handleCollectPayment('${customer.customer_id}', event)"
            style="width: 100%; padding: 7px 10px; background: #059669; color: #ffffff; border: none; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 1px 3px rgba(5,150,105,0.25); touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; transition: transform 0.08s ease, background-color 0.15s ease;"
            onmouseenter="this.style.backgroundColor='#047857'"
            onmouseleave="this.style.backgroundColor='#059669'"
            onmousedown="this.style.transform='scale(0.96)'; this.style.backgroundColor='#065f46'"
            onmouseup="this.style.transform='scale(1)'"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <span>Collect &#8377;${customer.pending_amount.toLocaleString('en-IN')}</span>
          </button>
        </div>
      `;

      if (marker) {
        marker.setLatLng(pos);
        if (icon) marker.setIcon(icon);
        marker.setZIndexOffset(isSelected || isCurrentStop ? 999 : 100);
        marker.setPopupContent(popupHtml);
      } else {
        marker = L.marker(pos, {
          icon: icon || undefined,
          title: `${customer.name} — Meter: ${customer.meter_number}`,
          zIndexOffset: isSelected || isCurrentStop ? 999 : 100,
        }).addTo(map);

        marker.bindPopup(popupHtml, {
          autoPan: false,
          closeButton: true,
          className: 'custom-leaflet-popup',
        });

        // Trigger TTS announcement on marker click
        marker.on('click', () => {
          enableVoiceAudio();
          onSelectCustomerRef.current(customer);
          announceCustomerInfo(customer, isMuted);
        });

        marker.on('popupopen', (e: any) => {
          const popupEl = e?.popup?.getElement?.() || document.getElementById(`map-info-collect-btn-${customer.customer_id}`);
          if (popupEl && L.DomEvent) {
            L.DomEvent.disableClickPropagation(popupEl);
            L.DomEvent.disableScrollPropagation(popupEl);
          }
          const btn = document.getElementById(`map-info-collect-btn-${customer.customer_id}`);
          if (btn) {
            if (L.DomEvent) {
              L.DomEvent.disableClickPropagation(btn);
            }
            btn.onclick = (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if ((window as any).__handleCollectPayment) {
                (window as any).__handleCollectPayment(customer.customer_id, ev);
              }
            };
          }
        });

        customerMarkersRef.current.set(customer.customer_id, marker);
      }
    });

    // Handle Selected Customer Popup
    if (selectedCustomer) {
      const selectedMarker = customerMarkersRef.current.get(selectedCustomer.customer_id);
      if (selectedMarker) {
        selectedMarker.openPopup();
      }
    } else {
      map.closePopup();
    }
  }, [isMapReady, customers, selectedCustomer, multiRoute, activeStopIndex, isMuted]);

  // ── 4. Render Multi-Stop TSP Route Polyline ─────────────────────────────────
  useEffect(() => {
    const L = leafletInstanceRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;

    const multiPath = multiRoute?.coordinates_path;
    if (multiPath && multiPath.length >= 2) {
      const latLngs: [number, number][] = multiPath
        .map((pt: any) => {
          const lat = typeof pt.latitude === 'number' ? pt.latitude : pt.lat;
          const lng = typeof pt.longitude === 'number' ? pt.longitude : pt.lng;
          if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            return [lat, lng] as [number, number];
          }
          return null;
        })
        .filter((pt): pt is [number, number] => pt !== null);

      if (latLngs.length >= 2) {
        if (!multiRoutePolylineRef.current) {
          multiRoutePolylineRef.current = L.polyline(latLngs, {
            color: '#0284c7',
            weight: 7,
            opacity: 0.95,
          }).addTo(map);
        } else {
          multiRoutePolylineRef.current.setLatLngs(latLngs);
          if (!map.hasLayer(multiRoutePolylineRef.current)) {
            multiRoutePolylineRef.current.addTo(map);
          }
        }

        // Auto-fit camera bounds once on customer list change if user hasn't manually zoomed/panned
        const customerIdsKey = customers.map((c) => c.customer_id).sort().join(',');
        if (customerIdsKey !== lastFittedMultiRouteRef.current) {
          lastFittedMultiRouteRef.current = customerIdsKey;
          if (!userHasInteractedRef.current) {
            isProgrammaticZoomRef.current = true;
            map.fitBounds(L.latLngBounds(latLngs), { padding: [80, 80] });
          }
        }
      }
    } else {
      if (multiRoutePolylineRef.current) {
        multiRoutePolylineRef.current.remove();
        multiRoutePolylineRef.current = null;
      }
    }
  }, [isMapReady, multiRoute, customers]);

  // ── 5. Leaflet Routing Machine + Turn-by-Turn Dynamic Voice TTS ──────────────
  useEffect(() => {
    const L = leafletInstanceRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;

    const isSingleNav = navState?.active && !multiRoute;
    const dest = isSingleNav ? navState.targetCustomer : (selectedCustomer && !multiRoute ? selectedCustomer : null);

    // If no target destination, clean up routing control and single polyline
    if (!dest || !officerCoords) {
      if (routingControlRef.current) {
        try {
          routingControlRef.current.remove();
        } catch {}
        routingControlRef.current = null;
      }
      if (singleRoutePolylineRef.current) {
        singleRoutePolylineRef.current.remove();
        singleRoutePolylineRef.current = null;
      }
      return;
    }

    const originLat = officerCoords.latitude;
    const originLng = officerCoords.longitude;

    const fingerprint = `${originLat.toFixed(3)}_${originLng.toFixed(3)}_${dest.customer_id}`;
    if (fingerprint === lastDirectionsKeyRef.current) return;
    lastDirectionsKeyRef.current = fingerprint;

    // Check if Leaflet Routing Machine is available
    if ((L as any).Routing && (L as any).Routing.control) {
      try {
        if (routingControlRef.current) {
          routingControlRef.current.setWaypoints([
            L.latLng(originLat, originLng),
            L.latLng(dest.latitude, dest.longitude),
          ]);
        } else {
          const routingControl = (L as any).Routing.control({
            waypoints: [
              L.latLng(originLat, originLng),
              L.latLng(dest.latitude, dest.longitude),
            ],
            router: (L as any).Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1',
              profile: 'driving',
            }),
            lineOptions: {
              styles: [{ color: '#0284c7', weight: 6, opacity: 0.9 }],
              extendToWaypoints: true,
              missingRouteStyles: [{ color: '#f59e0b', weight: 4 }],
            },
            show: false,
            addWaypoints: false,
            routeWhileDragging: false,
            fitSelectedRoutes: false,
            showAlternatives: false,
            createMarker: () => null,
          }).addTo(map);

          routingControl.on('routesfound', (e: any) => {
            const routes = e.routes;
            if (!routes || routes.length === 0) return;
            const route0 = routes[0];
            const instructions = route0.instructions || [];

            // Speak first maneuver dynamically using TTS
            if (instructions.length > 0) {
              const firstStep = instructions[0];
              const spokenManeuver = parseManeuverSpeech(
                firstStep.type,
                firstStep.modifier,
                firstStep.road,
                firstStep.distance
              );
              speakText(`Route found to ${dest.name}. ${spokenManeuver}`, { isMuted, urgent: true });
            }

            if (onDirectionsCalculatedRef.current) {
              const steps = instructions.map((inst: any) => {
                const speechText = parseManeuverSpeech(inst.type, inst.modifier, inst.road, inst.distance);
                return {
                  instruction: inst.text || speechText,
                  distance_text: inst.distance >= 1000 ? `${(inst.distance / 1000).toFixed(1)} km` : `${Math.round(inst.distance)} m`,
                  duration_text: inst.time >= 60 ? `${Math.round(inst.time / 60)} min` : `${Math.round(inst.time)} s`,
                };
              });

              const pathCoords: Coordinates[] = (route0.coordinates || []).map((latLng: any) => ({
                latitude: latLng.lat,
                longitude: latLng.lng,
              }));

              onDirectionsCalculatedRef.current({
                distance_meters: Math.round(route0.summary?.totalDistance || 0),
                distance_text: (route0.summary?.totalDistance || 0) >= 1000 ? `${((route0.summary?.totalDistance || 0) / 1000).toFixed(1)} km` : `${Math.round(route0.summary?.totalDistance || 0)} m`,
                duration_seconds: Math.round(route0.summary?.totalTime || 0),
                duration_text: (route0.summary?.totalTime || 0) >= 60 ? `${Math.round((route0.summary?.totalTime || 0) / 60)} min` : `${Math.round(route0.summary?.totalTime || 0)} s`,
                start_address: 'Officer GPS Location',
                end_address: `${dest.name} (${dest.address || 'Meter'})`,
                encoded_polyline: '',
                coordinates_path: pathCoords,
                steps,
              });
            }
          });

          routingControlRef.current = routingControl;
        }
        return;
      } catch (err) {
        console.warn('LRM routing initialization fallback to OSRM fetch:', err);
      }
    }

    // Direct OSRM Fallback if plugin is unavailable
    let isCancelled = false;
    fetchOSRMPath(originLat, originLng, dest.latitude, dest.longitude).then((result) => {
      if (isCancelled || !result || !mapRef.current) return;

      const pathLatLngs: [number, number][] = result.coordinates.map((pt) => [pt.latitude, pt.longitude]);

      if (!singleRoutePolylineRef.current) {
        singleRoutePolylineRef.current = L.polyline(pathLatLngs, {
          color: '#0284c7',
          weight: 6,
          opacity: 0.9,
        }).addTo(mapRef.current);
      } else {
        singleRoutePolylineRef.current.setLatLngs(pathLatLngs);
        if (!mapRef.current.hasLayer(singleRoutePolylineRef.current)) {
          singleRoutePolylineRef.current.addTo(mapRef.current);
        }
      }

      if (onDirectionsCalculatedRef.current) {
        const distKm = (result.distanceMeters / 1000).toFixed(1);
        const durMin = Math.round(result.durationSeconds / 60);

        onDirectionsCalculatedRef.current({
          distance_meters: result.distanceMeters,
          distance_text: result.distanceMeters >= 1000 ? `${distKm} km` : `${result.distanceMeters} m`,
          duration_seconds: result.durationSeconds,
          duration_text: durMin >= 60 ? `${Math.floor(durMin / 60)} hr ${durMin % 60} min` : `${durMin} min`,
          start_address: `Officer Location (${originLat.toFixed(4)}, ${originLng.toFixed(4)})`,
          end_address: `${dest.address || 'Meter Location'} (${dest.latitude.toFixed(4)}, ${dest.longitude.toFixed(4)})`,
          encoded_polyline: '',
          coordinates_path: result.coordinates,
          steps: result.steps,
        });

        if (result.steps.length > 0) {
          speakText(`Route found to ${dest.name}. ${result.steps[0].instruction}`, { isMuted });
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    isMapReady,
    officerCoords,
    navState?.targetCustomer,
    selectedCustomer,
    multiRoute,
    navState?.active,
    isMuted,
  ]);

  // ── 6. Layer Switcher (Roadmap / Satellite / Hybrid / Terrain) ───────────────
  const handleSelectLayer = (layer: MapLayerType) => {
    setCurrentLayer(layer);
    const config = TILE_LAYERS[layer] || TILE_LAYERS.roadmap;
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(config.url);
      if (tileLayerRef.current.options) {
        tileLayerRef.current.options.attribution = config.attribution;
        tileLayerRef.current.options.maxZoom = config.maxZoom;
      }
    }
  };

  // ── 7. Fit All Bounds ───────────────────────────────────────────────────────
  const handleFitAllBounds = () => {
    const L = leafletInstanceRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;

    userHasInteractedRef.current = false;
    const points: [number, number][] = [];

    if (officerCoords) {
      points.push([officerCoords.latitude, officerCoords.longitude]);
    }
    customers.forEach((c) => {
      if (typeof c.latitude === 'number' && typeof c.longitude === 'number') {
        points.push([c.latitude, c.longitude]);
      }
    });

    if (points.length > 0) {
      isProgrammaticZoomRef.current = true;
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
    }
  };

  // ── 8. Zoom Controls ────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    const map = mapRef.current;
    if (!map) return;
    userHasInteractedRef.current = true;
    disableFollowMode();
    map.zoomIn();
  };

  const handleZoomOut = () => {
    const map = mapRef.current;
    if (!map) return;
    userHasInteractedRef.current = true;
    disableFollowMode();
    map.zoomOut();
  };

  // ── 9. Compass Reset True North ────────────────────────────────────────────
  const handleResetNorth = () => {
    const map = mapRef.current;
    if (!map) return;
    if (officerCoords) {
      map.panTo([officerCoords.latitude, officerCoords.longitude]);
    }
  };

  // ── 10. 3D Perspective Tilt Toggle ──────────────────────────────────────────
  const handleToggle3DTilt = () => {
    setIs3D((prev) => {
      const next = !prev;
      if (mapContainerRef.current) {
        mapContainerRef.current.style.transform = next ? 'perspective(800px) rotateX(20deg)' : 'none';
        mapContainerRef.current.style.transition = 'transform 0.4s ease-out';
      }
      return next;
    });
  };

  // ── 11. Re-center / Follow Mode Toggle ──────────────────────────────────────
  const toggleFollowMode = () => {
    if (onToggleFollow) {
      onToggleFollow();
    } else {
      setIsFollowingInternal((prev) => !prev);
    }
    const map = mapRef.current;
    if (officerCoords && map) {
      map.setView([officerCoords.latitude, officerCoords.longitude], navState?.active ? 17 : 15);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Map tile container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Navigation Panel */}
      {navState && (
        <NavigationPanel
          navState={navState}
          onExitNavigation={onExitNavigation || (() => {})}
          onCollectPayment={onCollectPayment}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          multiRoute={multiRoute}
          currentStopIndex={activeStopIndex}
          onSelectStopIndex={onSelectStopIndex}
        />
      )}

      {/* Floating Map Controls */}
      <MapControls
        currentLayer={currentLayer}
        isFollowing={isFollowing}
        is3D={is3D}
        officerHeading={officerHeading}
        onToggleFollow={toggleFollowMode}
        onSelectLayer={handleSelectLayer}
        onFitBounds={handleFitAllBounds}
        onResetNorth={handleResetNorth}
        onToggle3D={handleToggle3DTilt}
        onOpenStreetView={
          selectedCustomer && onOpenStreetView
            ? () => onOpenStreetView(selectedCustomer)
            : undefined
        }
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* 360° Street View / Satellite Modal */}
      {streetView && onCloseStreetView && (
        <StreetViewModal streetView={streetView} onClose={onCloseStreetView} />
      )}
    </div>
  );
}
