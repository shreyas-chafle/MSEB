/**
 * Location Inspection Service
 */

export interface StreetViewCheckResult {
  available: boolean;
  lat?: number;
  lng?: number;
  message?: string;
}

export const checkStreetViewAvailability = async (
  lat: number,
  lng: number,
  _radiusMeters: number = 50
): Promise<StreetViewCheckResult> => {
  return {
    available: true,
    lat,
    lng,
  };
};
