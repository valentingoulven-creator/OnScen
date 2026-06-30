import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { LivesGeoPrefs } from '../lib/livesGeo';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const ACCENT: Record<string, string> = {
  purple: 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700',
  red: 'bg-red-500 hover:bg-red-400 active:bg-red-600',
  pink: 'bg-pink-600 hover:bg-pink-500 active:bg-pink-700',
};

export interface MapLocationPickerProps {
  mapGeo: LivesGeoPrefs;
  onPersist: (next: LivesGeoPrefs) => void;
  size?: 'default' | 'compact';
  accent?: 'purple' | 'red' | 'pink';
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

const PIN_HTML = `<div style="
  width:32px;
  height:40px;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));
  cursor:grab;
">
  <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="37" rx="6" ry="3" fill="rgba(0,0,0,0.35)"/>
    <path d="M16 2C9.373 2 4 7.373 4 14c0 8.75 12 24 12 24S28 22.75 28 14c0-6.627-5.373-12-12-12z"
      fill="#a855f7" stroke="#7c3aed" stroke-width="1.5"/>
    <circle cx="16" cy="14" r="5" fill="white"/>
  </svg>
</div>`;

export function MapLocationPicker({
  mapGeo,
  onPersist,
  size = 'default',
  accent = 'purple',
}: MapLocationPickerProps) {
  const lat = mapGeo.latitude;
  const lng = mapGeo.longitude;
  const label = mapGeo.label;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [markerPos, setMarkerPos] = useState({ lat, lng });
  const isCompact = size === 'compact';

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const zoom = isCompact ? 12 : 15;
    const map = L.map(container, {
      zoomControl: true,
      attributionControl: !isCompact,
      preferCanvas: false,
      maxZoom: 19,
    }).setView([lat, lng], zoom);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
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
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    onPersist({ ...mapGeo, latitude: markerPos.lat, longitude: markerPos.lng });
  };

  if (isCompact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative rounded-lg overflow-hidden" style={{ height: '10rem' }}>
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-[#12121a]/90 backdrop-blur-sm rounded-full px-2.5 py-1 border border-[#2a2a3d] shadow">
              <p className="text-[9px] text-gray-300 whitespace-nowrap">Déplacez le marqueur</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-mono text-purple-300 truncate">
            {formatCoord(markerPos.lat, markerPos.lng)}
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs text-white font-medium transition-colors ${ACCENT[accent] ?? ACCENT.purple}`}
          >
            Appliquer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0b0b0f]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3d] bg-[#12121a] shrink-0">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-sm font-semibold text-white">Ajustez la position exacte</h2>
          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => onPersist(mapGeo)}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition-colors"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-[#12121a]/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-[#2a2a3d] shadow-lg">
            <p className="text-[10px] text-gray-300 whitespace-nowrap">
              Déplacez le marqueur pour préciser l'emplacement
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-4 bg-[#12121a] border-t border-[#2a2a3d]">
        <p className="text-center text-[11px] font-mono text-purple-300 mb-3 tracking-wide">
          {formatCoord(markerPos.lat, markerPos.lng)}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onPersist(mapGeo)}
            className="flex-1 py-2.5 rounded-xl border border-[#2a2a3d] text-sm text-gray-300 hover:bg-[#1e1e2f] active:bg-[#252535] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm text-white font-semibold transition-colors ${ACCENT[accent] ?? ACCENT.purple}`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

export { formatCoord as formatLocationCoord };
