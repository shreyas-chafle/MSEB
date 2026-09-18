import api from './api';
import { RouteCalculationResult, MultiRouteCalculationResult, Customer, Coordinates } from '@/types';
import { calculateHaversineDistance } from '@/utils/geo';

export function decodePolyline(encoded: string): Coordinates[] {
  if (!encoded) return [];
  const points: Coordinates[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

export const routeService = {
  clearRouteCache() {
    // No-op: Caching disabled for real-time live route processing
  },

  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    customerId?: string,
    meterId?: string
  ): Promise<RouteCalculationResult> {
    try {
      const response = await api.post<RouteCalculationResult>('/api/routes/calculate', {
        origin,
        destination,
        customer_id: customerId,
        meter_id: meterId,
      });
      const data = response.data;
      if (data.encoded_polyline && (!data.coordinates_path || data.coordinates_path.length <= 2)) {
        const decoded = decodePolyline(data.encoded_polyline);
        if (decoded.length > 0) {
          data.coordinates_path = decoded;
        }
      }
      return data;
    } catch (err) {
      console.warn('Backend calculate route API offline, using client fallback:', err);
      return this.calculateClientRoute(origin, destination);
    }
  },

  calculateClientRoute(
    origin: Coordinates,
    destination: Coordinates
  ): RouteCalculationResult {
    const dist = calculateHaversineDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    ) * 1.35;
    const durSec = dist / 6.94;

    const midLat = (origin.latitude + destination.latitude) / 2;
    const midLng = (origin.longitude + destination.longitude) / 2;

    const pathCoords: Coordinates[] = [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: midLat, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];

    const distText = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;
    const durText = durSec >= 60 ? `${Math.round(durSec / 60)} min` : '< 1 min';

    return {
      distance_meters: Math.round(dist),
      distance_text: distText,
      duration_seconds: Math.round(durSec),
      duration_text: durText,
      start_address: `Officer Location (${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)})`,
      end_address: `Meter Location (${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)})`,
      encoded_polyline: '',
      coordinates_path: pathCoords,
      steps: [
        {
          instruction: 'Proceed along main road towards electricity meter',
          distance_text: distText,
          duration_text: durText,
        },
      ],
    };
  },


  async calculateMultiRoute(
    origin: Coordinates,
    customers: Customer[]
  ): Promise<MultiRouteCalculationResult> {
    try {
      const response = await api.post<MultiRouteCalculationResult>('/api/routes/calculate-multi', {
        origin,
        customers: customers.map((c) => ({
          customer_id: c.customer_id,
          name: c.name,
          meter_number: c.meter_number,
          latitude: c.latitude,
          longitude: c.longitude,
          pending_amount: c.pending_amount,
          address: c.address,
          priority: c.priority,
        })),
      });
      return response.data;
    } catch (err) {
      console.warn('Backend calculate-multi endpoint offline, performing client-side TSP optimization:', err);
      return this.calculateClientMultiRoute(origin, customers);
    }
  },

  // Client-side fallback TSP nearest-neighbor algorithm
  calculateClientMultiRoute(
    origin: Coordinates,
    customers: Customer[]
  ): MultiRouteCalculationResult {
    if (customers.length === 0) {
      return {
        total_distance_meters: 0,
        total_distance_text: '0 m',
        total_duration_seconds: 0,
        total_duration_text: '0 min',
        coordinates_path: [],
        stops: [],
      };
    }

    const unvisited = [...customers];
    const orderedCustomers: Customer[] = [];
    let currentLat = origin.latitude;
    let currentLng = origin.longitude;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = calculateHaversineDistance(
          currentLat,
          currentLng,
          unvisited[i].latitude,
          unvisited[i].longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextCust = unvisited.splice(nearestIdx, 1)[0];
      orderedCustomers.push(nextCust);
      currentLat = nextCust.latitude;
      currentLng = nextCust.longitude;
    }

    let totalDist = 0;
    let totalDur = 0;
    const path: Coordinates[] = [{ latitude: origin.latitude, longitude: origin.longitude }];

    let prevLat = origin.latitude;
    let prevLng = origin.longitude;

    const stops = orderedCustomers.map((cust, idx) => {
      const legDist = calculateHaversineDistance(prevLat, prevLng, cust.latitude, cust.longitude) * 1.35;
      const legDur = legDist / 6.94;

      totalDist += legDist;
      totalDur += legDur;

      path.push({ latitude: cust.latitude, longitude: cust.longitude });

      prevLat = cust.latitude;
      prevLng = cust.longitude;

      const legDistText = legDist >= 1000 ? `${(legDist / 1000).toFixed(2)} km` : `${Math.round(legDist)} m`;
      const legDurText = legDur >= 60 ? `${Math.round(legDur / 60)} min` : '< 1 min';

      return {
        sequence: idx + 1,
        customer_id: cust.customer_id,
        name: cust.name,
        meter_number: cust.meter_number,
        pending_amount: cust.pending_amount,
        address: cust.address || '',
        latitude: cust.latitude,
        longitude: cust.longitude,
        distance_from_prev_meters: Math.round(legDist),
        distance_from_prev_text: legDistText,
        duration_from_prev_text: legDurText,
      };
    });

    const totalDistText = totalDist >= 1000 ? `${(totalDist / 1000).toFixed(2)} km` : `${Math.round(totalDist)} m`;
    const totalDurText = totalDur >= 60 ? `${Math.round(totalDur / 60)} min` : '< 1 min';

    return {
      total_distance_meters: Math.round(totalDist),
      total_distance_text: totalDistText,
      total_duration_seconds: Math.round(totalDur),
      total_duration_text: totalDurText,
      coordinates_path: path,
      stops,
    };
  },
};

