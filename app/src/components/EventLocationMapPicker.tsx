import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const PIN_HTML = `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));cursor:grab;">
  <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="37" rx="6" ry="3" fill="rgba(0,0,0,0.35)"/>
    <path d="M16 2C9.373 2 4 7.373 4 14c0 8.75 12 24 12 24S28 22.75 28 14c0-6.627-5.373-12-12-12z"
      fill="#a855f7" stroke="#7c3aed" stroke-width="1.5"/>
    <circle cx="16" cy="14" r="5" fill="white"/>
  </svg>
</div>`;

export interface EventLocationMapPickerProps {
  lat: number;
  lng: number;
  label: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export function formatPickerCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

export function EventLocationMapPicker({
  lat,
  lng,
  label,
  onConfirm,
  onCancel,
}: EventLocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [markerPos, setMarkerPos] = useState({ lat, lng });

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false,
      maxZoom: 19,
    }).setView([lat, lng], 15);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
      noWrap: true,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: PIN_HTML,
      iconSize: [32, 40],
      iconAnchor: [16, 38],
    });

    const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
    markerRef.current = marker;
    mapInstanceRef.current = map;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setMarkerPos({ lat: pos.lat, lng: pos.lng });
    });

    const rafId = requestAnimationFrame(() => map.invalidateSize());
    const sizeTimers = [
      window.setTimeout(() => map.invalidateSize(), 80),
      window.setTimeout(() => map.invalidateSize(), 320),
    ];
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      sizeTimers.forEach((id) => window.clearTimeout(id));
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = (
    <div className="event-location-map-picker fixed inset-0 z-[200] flex flex-col bg-[#0b0b0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3d] bg-[#12121a] shrink-0">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-sm font-semibold text-white">Ajustez la position exacte</h2>
          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{label}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition-colors"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0" style={{ minHeight: '12rem' }}>
        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-0" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-[#12121a]/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-[#2a2a3d] shadow-lg">
            <p className="text-[10px] text-gray-300 whitespace-nowrap">
              Déplacez le marqueur pour préciser l'emplacement
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pt-3 pb-4 bg-[#12121a] border-t border-[#2a2a3d]">
        <p className="text-center text-[11px] font-mono text-purple-300 mb-3 tracking-wide">
          {formatPickerCoord(markerPos.lat, markerPos.lng)}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#2a2a3d] text-sm text-gray-300 hover:bg-[#1e1e2f] active:bg-[#252535] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(markerPos.lat, markerPos.lng)}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-sm text-white font-semibold transition-colors"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
