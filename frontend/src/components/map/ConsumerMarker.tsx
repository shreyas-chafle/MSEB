'use client';

import { getMarkerStatusColor } from '@/utils/geo';

export const createConsumerMarkerIcon = (
  L: any,
  status: string,
  priority?: string,
  isSelected: boolean = false,
  sequence?: number,
  meterNumber?: string
) => {
  const { hex } = getMarkerStatusColor(status, priority, isSelected);

  const pinFill = isSelected ? '#0284c7' : hex;
  const pinInnerContent = sequence !== undefined
    ? `<text x="17" y="22" text-anchor="middle" fill="#FFFFFF" font-size="13" font-weight="900" font-family="sans-serif">${sequence}</text>`
    : `<circle cx="17" cy="17" r="10" fill="#0F172A"/><path d="M16 9L11 18H16L15 25L21 15H16L17 9Z" fill="${pinFill}"/>`;

  const meterText = meterNumber
    ? (meterNumber.startsWith('MTR') || meterNumber.startsWith('#') ? meterNumber : `MTR-${meterNumber.slice(-6)}`)
    : '';

  const badgeSvg = meterText
    ? `
      <rect x="2" y="39" width="70" height="16" rx="4" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="37" y="50.5" text-anchor="middle" fill="#FFFFFF" font-size="8.5" font-weight="800" font-family="sans-serif" letter-spacing="0.2">${meterText}</text>
    `
    : '';

  const totalHeight = meterText ? 56 : 40;
  const pinSvg = `
    <svg width="74" height="${totalHeight}" viewBox="0 0 74 ${totalHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(20, 0)">
        <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 38 17 38C17 38 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="${pinFill}" stroke="#FFFFFF" stroke-width="2"/>
        ${pinInnerContent}
      </g>
      ${badgeSvg}
    </svg>
  `;

  if (!L || !L.divIcon) {
    return null;
  }

  const w = isSelected ? 84 : 74;
  const h = isSelected ? (totalHeight + 10) : totalHeight;
  const anchorX = isSelected ? 42 : 37;
  const anchorY = isSelected ? 48 : 38;

  return L.divIcon({
    html: pinSvg,
    className: 'leaflet-custom-marker',
    iconSize: [w, h],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -anchorY + 8],
  });
};
