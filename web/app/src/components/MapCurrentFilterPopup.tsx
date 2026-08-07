import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LivesBrowseFilterModal,
  LivesBrowseFilterPanel,
} from './LivesBrowseGrid';
import type { MapSalonFilterCriteria } from './MapSalonFilterSheet';
import { getLivesGeo, MAP_GEO_CHANGED_EVENT, setLivesGeo, type LivesGeoPrefs } from '../lib/livesGeo';
import {
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  NEARBY_SORT_OPTIONS,
  setNearbyPanelPreferences,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import type { MapEventFilterCriteria } from '../lib/mapEventFilter';
import { getFeedEventTypeDisplayLabel, type FeedEventType } from '../lib/eventType';

export type MapActiveFilterKind = 'lives' | 'salon' | 'events' | null;

interface MapCurrentFilterPopupProps {
  open: boolean;
  onClose: () => void;
  activeFilter: MapActiveFilterKind;
  itemCount: number;
  eventCriteria: MapEventFilterCriteria;
  salonCriteria: MapSalonFilterCriteria;
  onEditSalon: () => void;
  onEditEvents: () => void;
  onDisableLives: () => void;
  onDisableSalon: () => void;
  onDisableEvents: () => void;
  onActivateLives: () => void;
  onActivateSalon: () => void;
  onActivateEvents: () => void;
}

function formatFilterDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e2f] bg-[#0b0b0f] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-sm text-gray-200 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function eventTypeLabel(t: (key: string) => string, eventType: MapEventFilterCriteria['eventType']): string {
  if (eventType === 'all') return t('map.eventFilterTypeAll');
  const labels: Record<FeedEventType, string> = {
    dance: getFeedEventTypeDisplayLabel(t, 'dance'),
    chant: getFeedEventTypeDisplayLabel(t, 'chant'),
    autre: getFeedEventTypeDisplayLabel(t, 'autre'),
  };
  return labels[eventType] ?? eventType;
}

function salonGenresLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  criteria: MapSalonFilterCriteria
): string {
  const { affinityGenres } = criteria;
  if (affinityGenres === 'all') return t('map.salonFilterAffinitiesAll');
  if (!affinityGenres || affinityGenres.length === 0) {
    return t('map.salonFilterAffinitiesNone');
  }
  return affinityGenres.join(' · ');
}

function MapFilterSummaryBody({
  activeFilter,
  itemCount,
  eventCriteria,
  salonCriteria,
  onEditSalon,
  onEditEvents,
  onDisableLives,
  onDisableSalon,
  onDisableEvents,
  onActivateLives,
  onActivateSalon,
  onActivateEvents,
  onClose,
}: Omit<MapCurrentFilterPopupProps, 'open'>) {
  const { t } = useTranslation();
  const geo = getLivesGeo();
  const panelPrefs = getNearbyPanelPreferences();
  const sortLabel = NEARBY_SORT_OPTIONS.find((o) => o.id === panelPrefs.sortBy)?.label ?? null;

  const filterMeta = useMemo(() => {
    if (activeFilter === 'lives') {
      return {
        title: t('map.currentFilterLivesTitle'),
        accent: 'text-red-300',
      };
    }
    if (activeFilter === 'salon') {
      return {
        title: t('map.currentFilterSalonTitle'),
        accent: 'text-fuchsia-200',
      };
    }
    if (activeFilter === 'events') {
      return {
        title: t('map.currentFilterEventsTitle'),
        accent: 'text-purple-200',
      };
    }
    return {
      title: t('map.currentFilterNoneTitle'),
      accent: 'text-gray-300',
    };
  }, [activeFilter, t]);

  const eventPeriodLabel = useMemo(() => {
    const from = formatFilterDate(eventCriteria.dateFrom);
    const to = formatFilterDate(eventCriteria.dateTo);
    if (from && to) return `${from} → ${to}`;
    if (from) return `${t('map.eventFilterDateFrom')} ${from}`;
    if (to) return `${t('map.eventFilterDateTo')} ${to}`;
    return t('map.currentFilterEventsToday');
  }, [eventCriteria.dateFrom, eventCriteria.dateTo, t]);

  return (
    <>
      <div className="shrink-0 flex items-start justify-between gap-2 px-4 py-3 border-b border-[#1e1e2f] bg-[#0f0f16]">
        <div className="min-w-0">
          <h3 id="lives-filter-title" className={`text-sm font-semibold ${filterMeta.accent}`}>
            {filterMeta.title}
          </h3>
          {activeFilter ? (
            <p className="text-[11px] text-gray-500 mt-0.5">
              {t('map.currentFilterCount', { count: itemCount })}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-0.5">{t('map.currentFilterNoneHint')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition touch-manipulation shrink-0"
          aria-label={t('map.currentFilterClose')}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
        {activeFilter === 'lives' && (
          <>
            <SummaryRow label={t('map.currentFilterZoneLabel')} value={geo.label} />
            {sortLabel ? <SummaryRow label={t('map.salonFilterSortLabel')} value={sortLabel} /> : null}
          </>
        )}

        {activeFilter === 'salon' && (
          <>
            {salonCriteria.location.trim() ? (
              <SummaryRow label={t('map.eventFilterLocationPlaceholder')} value={salonCriteria.location.trim()} />
            ) : null}
            <SummaryRow
              label={t('map.salonFilterSoundTypes')}
              value={salonGenresLabel(t, salonCriteria)}
            />
          </>
        )}

        {activeFilter === 'events' && (
          <>
            <SummaryRow label={t('map.eventFilterDateLabel')} value={eventPeriodLabel} />
            <SummaryRow
              label={t('map.eventFilterTypeLabel')}
              value={eventTypeLabel(t, eventCriteria.eventType)}
            />
            {eventCriteria.location.trim() ? (
              <SummaryRow
                label={t('map.eventFilterLocationPlaceholder')}
                value={`${eventCriteria.location.trim()} (${t('map.eventFilterRadius', { km: eventCriteria.radiusKm || 30 })})`}
              />
            ) : null}
          </>
        )}

        {!activeFilter && (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                onActivateLives();
                onClose();
              }}
              className="min-h-11 px-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-200 hover:bg-red-500/15 transition touch-manipulation text-left"
            >
              {t('map.currentFilterActivateLives')}
            </button>
            <button
              type="button"
              onClick={() => {
                onActivateSalon();
                onClose();
              }}
              className="min-h-11 px-3 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500/15 transition touch-manipulation text-left"
            >
              {t('map.currentFilterActivateSalon')}
            </button>
            <button
              type="button"
              onClick={() => {
                onActivateEvents();
                onClose();
              }}
              className="min-h-11 px-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-sm font-semibold text-purple-200 hover:bg-purple-500/15 transition touch-manipulation text-left"
            >
              {t('map.currentFilterActivateEvents')}
            </button>
          </div>
        )}
      </div>

      {activeFilter && (
        <div className="shrink-0 px-3 py-3 border-t border-[#1e1e2f] bg-[#0f0f16] flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
          {activeFilter === 'lives' && (
            <>
              <button
                type="button"
                onClick={() => {
                  onDisableLives();
                  onClose();
                }}
                className="w-full min-h-11 rounded-xl border border-[#2d2d3d] text-sm font-semibold text-gray-300 hover:text-red-200 hover:border-red-500/40 transition touch-manipulation"
              >
                {t('map.currentFilterDisableLives')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-11 rounded-xl bg-red-500/90 hover:bg-red-500 text-sm font-semibold text-white transition touch-manipulation"
              >
                {t('map.currentFilterDone')}
              </button>
            </>
          )}
          {activeFilter === 'salon' && (
            <>
              <button
                type="button"
                onClick={() => {
                  onEditSalon();
                  onClose();
                }}
                className="w-full min-h-11 rounded-xl bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-semibold text-white transition touch-manipulation"
              >
                {t('map.currentFilterEditSalon')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDisableSalon();
                  onClose();
                }}
                className="w-full min-h-11 rounded-xl border border-[#2d2d3d] text-sm font-semibold text-gray-300 hover:text-fuchsia-200 hover:border-fuchsia-500/40 transition touch-manipulation"
              >
                {t('map.salonFilterDisableTitle')}
              </button>
            </>
          )}
          {activeFilter === 'events' && (
            <>
              <button
                type="button"
                onClick={() => {
                  onEditEvents();
                  onClose();
                }}
                className="w-full min-h-11 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-sm font-semibold text-white transition touch-manipulation"
              >
                {t('map.currentFilterEditEvents')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDisableEvents();
                  onClose();
                }}
                className="w-full min-h-11 rounded-xl border border-[#2d2d3d] text-sm font-semibold text-gray-300 hover:text-purple-200 hover:border-purple-500/40 transition touch-manipulation"
              >
                {t('map.eventFilterDisableTitle')}
              </button>
            </>
          )}
        </div>
      )}

      {!activeFilter && (
        <div className="shrink-0 px-3 py-3 border-t border-[#1e1e2f] bg-[#0f0f16] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 rounded-xl border border-[#2d2d3d] text-sm font-semibold text-gray-300 hover:text-white transition touch-manipulation"
          >
            {t('map.currentFilterDone')}
          </button>
        </div>
      )}
    </>
  );
}

export function MapLivesFilterEditor({ onClose }: { onClose: () => void }) {
  const [geo, setGeo] = useState<LivesGeoPrefs>(getLivesGeo);
  const [panelPrefs, setPanelPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());

  useEffect(() => {
    const syncPrefs = () => setPanelPrefs(getNearbyPanelPreferences());
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    };
  }, []);

  useEffect(() => {
    const syncGeo = () => setGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
  }, []);

  const persistGeo = useCallback((next: LivesGeoPrefs) => {
    setGeo(next);
    setLivesGeo(next);
  }, []);

  const updatePanelPrefs = useCallback((patch: Partial<Pick<NearbyPanelPreferences, 'sortBy'>>) => {
    setPanelPrefs(setNearbyPanelPreferences(patch));
  }, []);

  const resetFilters = useCallback(() => {
    updatePanelPrefs({ sortBy: 'none' });
  }, [updatePanelPrefs]);

  return (
    <LivesBrowseFilterPanel
      geo={geo}
      onPersistGeo={persistGeo}
      showCountryFilter={false}
      countryOptions={[]}
      countryFilter="all"
      onCountryFilter={() => {}}
      sortBy={panelPrefs.sortBy}
      onSortBy={(id) => updatePanelPrefs({ sortBy: id === 'none' ? 'none' : id })}
      onClose={onClose}
      onReset={resetFilters}
    />
  );
}

export function MapCurrentFilterPopup(props: MapCurrentFilterPopupProps) {
  const { open, onClose, activeFilter } = props;

  if (!open) return null;

  return (
    <LivesBrowseFilterModal open={open} onClose={onClose}>
      {activeFilter === 'lives' ? (
        <MapLivesFilterEditor onClose={onClose} />
      ) : (
        <MapFilterSummaryBody {...props} />
      )}
    </LivesBrowseFilterModal>
  );
}
