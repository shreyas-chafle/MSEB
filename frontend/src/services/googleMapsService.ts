/**
 * GIS Geocoding & Location Service (OpenStreetMap Nominatim)
 */

export const loadGoogleMapsScript = async (_apiKey?: string): Promise<void> => {
  // No-op for Leaflet / OpenStreetMap
  return Promise.resolve();
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
  }

  return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
};
