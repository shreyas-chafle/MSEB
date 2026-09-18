'use client';

import React, { useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { StreetViewState } from '@/types';

interface StreetViewModalProps {
  streetView: StreetViewState;
  onClose: () => void;
}

export default function StreetViewModal({ streetView, onClose }: StreetViewModalProps) {
  const panoRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!streetView.isOpen || !panoRef.current) return;

    let isMounted = true;
    import('leaflet').then((LModule) => {
      if (!isMounted || !panoRef.current) return;
      const L = LModule.default || LModule;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(panoRef.current, {
        center: [streetView.lat, streetView.lng],
        zoom: 18,
        zoomControl: true,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: '&copy; Esri World Imagery' }
      ).addTo(map);

      L.marker([streetView.lat, streetView.lng], {
        title: streetView.customerName || 'Electricity Meter Location',
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [streetView]);

  if (!streetView.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              High-Resolution Satellite Location Inspector (Leaflet)
            </h3>
            {streetView.customerName && (
              <p className="text-xs text-slate-400 mt-0.5">
                Consumer: <span className="text-slate-200 font-bold">{streetView.customerName}</span> ({streetView.address})
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 relative bg-slate-950">
          <div ref={panoRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
