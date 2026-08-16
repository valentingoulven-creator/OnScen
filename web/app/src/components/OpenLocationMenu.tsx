import { useTranslation } from 'react-i18next';
import { openExternalMap, type ExternalMapProvider } from '../lib/openExternalMap';
import { openOnscenMapAtLocation } from '../lib/openOnscenMapAtLocation';

export interface OpenLocationMenuProps {
  open: boolean;
  onClose: () => void;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  overlayZClass?: string;
}

type MapItem = {
  id: ExternalMapProvider;
  labelKey: string;
  colorClass: string;
};

const MAP_ITEMS: MapItem[] = [
  { id: 'google', labelKey: 'openLocation.googleMaps', colorClass: 'text-emerald-300' },
  { id: 'waze', labelKey: 'openLocation.waze', colorClass: 'text-sky-300' },
  { id: 'apple', labelKey: 'openLocation.appleMaps', colorClass: 'text-blue-300' },
];

function MapProviderIcon({ id, className }: { id: ExternalMapProvider; className?: string }) {
  const cn = className ?? 'w-5 h-5';
  switch (id) {
    case 'google':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'waze':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M4 15l4-4 3 3 5-6 4 4" />
        </svg>
      );
    case 'apple':
      return (
        <svg viewBox="0 0 24 24" className={cn} fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
  }
}

export function OpenLocationMenu({
  open,
  onClose,
  label,
  latitude,
  longitude,
  overlayZClass = 'z-[120]',
}: OpenLocationMenuProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const handleOpenOnscenMap = () => {
    openOnscenMapAtLocation({ label, latitude, longitude });
    onClose();
  };

  const handleOpen = (provider: ExternalMapProvider) => {
    openExternalMap(provider, { label, latitude, longitude });
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-end sm:items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-location-menu-title"
    >
      <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl ms-modal-panel bg-[#12121a] border border-[#2d2d3d] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f] sticky top-0 bg-[#12121a] z-10">
          <h2 id="open-location-menu-title" className="font-bold text-white text-sm">
            {t('openLocation.title', { defaultValue: 'Ouvrir le lieu' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white rounded-full"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <p className="px-4 pt-3 text-[11px] text-gray-400 leading-snug line-clamp-2">{label}</p>

        <ul className="py-2 px-3">
          <li>
            <button
              type="button"
              onClick={handleOpenOnscenMap}
              className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/15 shrink-0 text-purple-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-white">
                {t('openLocation.onscenMap', { defaultValue: 'Carte OnScen' })}
              </span>
            </button>
          </li>
          {MAP_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleOpen(item.id)}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a28] shrink-0 ${item.colorClass}`}
                >
                  <MapProviderIcon id={item.id} />
                </span>
                <span className="text-sm font-semibold text-white">{t(item.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
