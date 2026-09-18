/**
 * Calculate Haversine distance in meters between two lat/lng points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determine marker status color code:
 * RED = High priority / Overdue
 * YELLOW = Pending bill
 * GREEN = Bill collected / Paid
 * BLUE = Selected customer
 */
export function getMarkerStatusColor(
  status: string,
  priority?: string,
  isSelected?: boolean
): { color: string; hex: string; badgeClass: string } {
  if (isSelected) {
    return {
      color: 'BLUE',
      hex: '#2563eb',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    };
  }

  if (status === 'paid') {
    return {
      color: 'GREEN',
      hex: '#16a34a',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }

  if (status === 'overdue' || priority === 'high' || priority === 'critical') {
    return {
      color: 'RED',
      hex: '#dc2626',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }

  return {
    color: 'YELLOW',
    hex: '#eab308',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  };
}
