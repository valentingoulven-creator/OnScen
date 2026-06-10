import { useCallback, useEffect, useState } from 'react';
import {
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  setLivesGeo,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { MapLocationPicker } from './MapLocationPicker';

function LocationPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
        fill="currentColor"
        fillOpacity="0.35"
      />
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
    </svg>
  );
}

interface MapLocationPinButtonProps {
  /** Ferme le panneau et retire le fond fixe quand la carte n'est pas l'onglet actif. */
  isActive?: boolean;
}

export function MapLocationPinButton({ isActive = true }: MapLocationPinButtonProps) {
  const [open, setOpen] = useState(false);
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());

  useEffect(() => {
    const syncGeo = () => setMapGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => {
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    };
  }, []);

  useEffect(() => {
    if (!isActive) setOpen(false);
  }, [isActive]);

  const persistMapGeo = useCallback((next: LivesGeoPrefs) => {
    setMapGeo(next);
    setLivesGeo(next);
  }, []);

  if (!isActive) return null;

  return (
    <div className="relative shrink-0 self-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={mapGeo.label}
        aria-label={`Localisation : ${mapGeo.label}. Ouvrir le choix de lieu`}
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-[#12121a]/95 border border-[#2d2d3d] hover:border-purple-500/50 text-purple-400 shadow-lg backdrop-blur-md active:scale-95 transition"
      >
        <LocationPinIcon className="w-5 h-5" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[36] cursor-default"
            aria-label="Fermer le choix de localisation"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1.5 z-[37] w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-[#12121a]/98 border border-[#2d2d3d] shadow-xl backdrop-blur-md overflow-hidden">
            <div className="px-2.5 py-2.5 max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain">
              <MapLocationPicker mapGeo={mapGeo} onPersist={persistMapGeo} size="compact" accent="purple" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}


