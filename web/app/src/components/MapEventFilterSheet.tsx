import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapEventFilterForm } from './MapEventFilterForm';
import type { MapEventFilterCriteria } from '../lib/mapEventFilter';

interface MapEventFilterSheetProps {
  open: boolean;
  initialCriteria: MapEventFilterCriteria;
  profileCity?: string;
  onClose: () => void;
  onApply: (criteria: MapEventFilterCriteria) => void;
  /** Vol carte vers la ville sélectionnée (aperçu avant Appliquer). */
  onPreviewCity?: (latitude: number, longitude: number, location: string) => void;
}

export function MapEventFilterSheet({
  open,
  initialCriteria,
  profileCity,
  onClose,
  onApply,
  onPreviewCity,
}: MapEventFilterSheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-event-filter-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col bg-[#12121a] border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-purple-500/20 flex items-center justify-between gap-3 bg-purple-950/30">
          <div className="min-w-0">
            <h2 id="map-event-filter-title" className="font-bold text-purple-100 flex items-center gap-2">
              <span aria-hidden>📅</span>
              {t('map.eventFilterTitle')}
            </h2>
            <p className="text-[11px] text-purple-300/70 mt-0.5">{t('map.eventFilterHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition shrink-0"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <MapEventFilterForm
          active={open}
          initialCriteria={initialCriteria}
          profileCity={profileCity}
          onApply={onApply}
          onCancel={onClose}
          onPreviewCity={onPreviewCity}
          className="bg-[#12121a]"
        />
      </div>
    </div>
  );
}
