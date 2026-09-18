'use client';

export const createOfficerMarkerIcon = (L: any, heading: number | null = 0) => {
  const rotationAngle = heading !== null && !isNaN(heading) ? heading : 0;

  // Navigation arrow icon (Leaflet DivIcon)
  const svgContent = `
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Soft GPS Accuracy Halo -->
      <circle cx="22" cy="22" r="18" fill="#2563eb" fill-opacity="0.18" />
      <circle cx="22" cy="22" r="18" stroke="#3b82f6" stroke-width="1" stroke-opacity="0.4" />
      
      <!-- Clean Navigation Arrow -->
      <g transform="rotate(${rotationAngle}, 22, 22)">
        <path d="M22 6 L33 36 L22 29 L11 36 Z" fill="#2563eb" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>
      </g>
    </svg>
  `;

  if (!L || !L.divIcon) {
    return null;
  }

  return L.divIcon({
    html: svgContent,
    className: 'leaflet-custom-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};
