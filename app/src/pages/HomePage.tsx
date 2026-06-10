import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket, onSocketConnect } from '../lib/socket';
import { MapView, type MapViewHandle, type MapStyle } from '../components/MapView';
import { NearbyPeoplePanel } from '../components/NearbyPeoplePanel';
import { MapCityEventsPanel } from '../components/MapCityEventsPanel';
import { MapEventFilterSheet } from '../components/MapEventFilterSheet';
import { MapSalonListenSheet } from '../components/MapSalonListenSheet';
import { MapLiveListenSheet } from '../components/MapLiveListenSheet';
import { CreateSalonModal } from '../components/CreateSalonModal';
import { MapAdBanner } from '../components/MapAdBanner';
import { MAP_EVENTS_REFRESH_EVENT, MAP_OPEN_CREATE_SALON_EVENT } from '../lib/mapUiEvents';
import { isAppa2Layout, type AppLayoutId } from '../lib/appLayout';
import {
  createDefaultEventFilter,
  filterMapEventsByCriteria,
  resolveDefaultUserCityLabel,
  type MapEventFilterCriteria,
} from '../lib/mapEventFilter';
import { loadMapEventMarkers } from '../lib/mapFeedEvents';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { clusterMapEventsByCity, getCityMapView } from '../lib/mapEventClusters';
import {
  buildMapSidebarContent,
  countLivesFilterBadge,
  countMapSidebarItems,
} from '../lib/mapSidebarContent';
import {
  clipLivesForMapView,
  clipPeopleForMapView,
  clipSalonsForMapView,
  filterEventClustersInViewport,
  filterMarkersInViewport,
  filterSalonsForSalonMapFilter,
  getDistanceKm,
  getFlatMapDetailTier,
  getMapBoundsCenter,
  GLOBE_ALTITUDE_CITY_MAX,
  mapSidebarDetailEqual,
  shouldClipMapMarkersToViewport,
  shouldShowAllSalonsAtCityZoom,
  type MapViewDetailState,
} from '../lib/mapMarkerVisibility';
import type { NearbyPerson, Salon, Live, MapEventMarker, MapEventCityCluster } from '../types';
import { getNearbyRadiusKm, getPrivacyPreferences, SETTINGS_CHANGED_EVENT } from '../lib/settings';
import {
  DEFAULT_CENTER,
  getLivesGeo,
  getNearbyQueryCenter,
  isFixedMapGeoSource,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import {
  filterLivesForMap,
  filterNearbyPeople,
  filterSalonsForMap,
  getNearbyPanelPreferences,
  isNearbyDistanceFilterActive,
  NEARBY_PANEL_CHANGED_EVENT,
  peopleMarkersOnMap,
  setNearbyPanelPreferences,
  sortLivesForNearby,
  sortNearbyPeople,
  sortSalonsForNearby,
} from '../lib/nearbyPanelSettings';
import { pauseAllReelsMediaInDom } from '../lib/reelsMedia';
import { releaseAppMediaFocus, requestAppMediaFocus } from '../lib/appMediaFocus';
import { clearMapInlineListenSession } from '../lib/mapListenSession';
import { clearSalonUrlFromBar } from '../lib/salonDeepLink';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';
import type { PlaybackState } from '../types';

const NEARBY_PEOPLE_STORAGE_KEY = 'melosong_show_nearby_people';
const MAP_STYLE_KEY = 'soundly_map_style';
const MAP_LIVE_ZOOM = 15;
/** Recentrer : quartier (GPS) vs ville (profil). */
const MAP_RECENTER_ZOOM_GPS = 13;
const MAP_RECENTER_ZOOM_CITY = 12;
/** Boutons Lives / Évènement (pile haut-gauche carte) — padding, typo et hauteur alignés. */
const MAP_STACK_FILTER_BTN =
  'w-full min-h-[2rem] px-3 py-2 rounded-full border shadow-lg active:scale-95 transition shrink-0 text-[10px] sm:text-[11px] font-bold leading-none whitespace-nowrap flex items-center justify-center gap-1.5';

function findSalonForLive(live: Live, salons: Salon[]): Salon | undefined {
  return salons.find(
    (s) =>
      s.id === live.id ||
      (live.salonId != null && s.id === live.salonId) ||
      (s.isLive && s.hostId === live.hostId)
  );
}

function liveFromNearbyPerson(person: NearbyPerson, liveId: string): Live | null {
  if (person.latitude == null || person.longitude == null) return null;
  if (!isValidLatLng(person.latitude, person.longitude)) return null;
  const platform = person.listeningPlatform ?? person.currentListening?.platform ?? 'youtube';
  const listening = person.currentListening;
  return {
    id: liveId,
    salonId: person.salonId,
    hostId: person.id,
    hostName: person.username,
    hostUsernameColor: person.usernameColor,
    hostUsernameWaveFrom: person.usernameWaveFrom,
    hostUsernameWaveTo: person.usernameWaveTo,
    title: person.salonTitle ?? `Live de ${person.username}`,
    platform,
    playbackState: {
      platform,
      trackId: '',
      title: listening?.title ?? person.salonTitle ?? 'En direct',
      artist: listening?.artist ?? '',
      albumArtUrl: listening?.albumArtUrl,
      isPlaying: listening?.isPlaying ?? true,
      progressMs: 0,
      updatedAt: Date.now(),
    },
    latitude: person.latitude,
    longitude: person.longitude,
    viewersCount: person.liveViewersCount ?? 0,
    isActive: true,
  };
}

interface HomePageProps {
  appLayout?: AppLayoutId;
  /** Ouvre la page plein écran du salon (bouton Salon de la fiche carte). */
  onOpenSalon?: (salonId: string) => void;
  onOpenLive: (liveId: string) => void;
  onOpenLiveTab?: () => void;
  onOpenProfile: (person: NearbyPerson) => void;
  onOpenReel?: (reelId: string) => void;
  /** Ouvre une publication du fil (onglet Actualités). */
  onOpenFeedPost?: (postId: string) => void;
  mapProfileOpen?: boolean;
  /** Fermer le profil overlay (clic fond de carte, etc.). */
  onCloseMapProfile?: () => void;
  /** Onglet Carte visible : autorise l'audio du bottom sheet salon. */
  mapPlaybackActive?: boolean;
  /** Réouvre la fiche salon carte après réduction du grand salon. */
  restoreSalonId?: string | null;
  onSalonMapRestored?: () => void;
}

export function HomePage({
  appLayout = 'default',
  onOpenSalon,
  onOpenLive,
  onOpenLiveTab,
  onOpenProfile,
  onOpenFeedPost,
  mapProfileOpen = false,
  onCloseMapProfile,
  mapPlaybackActive = true,
  restoreSalonId,
  onSalonMapRestored,
}: HomePageProps) {
  const { t } = useTranslation();
  const appa2 = isAppa2Layout(appLayout);
  const nearbyLayout = appa2 ? ('bottom' as const) : ('side' as const);
  const { user, token, setUserFromProfile } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<NearbyPerson[]>([]);
  const [selected, setSelected] = useState<Salon | null>(null);
  const [selectedLive, setSelectedLive] = useState<Live | null>(null);
  const [center, setCenter] = useState<[number, number]>(() => [...DEFAULT_CENTER]);
  const setSafeCenter = useCallback((coords: [number, number]) => {
    if (!isValidLatLng(coords[0], coords[1])) {
      setCenter([...DEFAULT_CENTER]);
      return;
    }
    setCenter(sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER));
  }, []);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [showNearbyPeople, setShowNearbyPeople] = useState(
    () => localStorage.getItem(NEARBY_PEOPLE_STORAGE_KEY) !== 'false'
  );
  const [mapStyle, setMapStyle] = useState<MapStyle>(
    () => (localStorage.getItem(MAP_STYLE_KEY) as MapStyle | null) ?? 'flat'
  );
  const [nearbyPanelPrefs, setNearbyPanelPrefs] = useState(getNearbyPanelPreferences);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const salonSheetRef = useRef<HTMLDivElement>(null);
  const liveSheetRef = useRef<HTMLDivElement>(null);
  const mapViewRef = useRef<MapViewHandle>(null);
  const [salonSheetExpanded, setSalonSheetExpanded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showEventMarkers, setShowEventMarkers] = useState(false);
  const [eventFilterCriteria, setEventFilterCriteria] =
    useState<MapEventFilterCriteria>(createDefaultEventFilter);
  const [showEventFilterSheet, setShowEventFilterSheet] = useState(false);

  useEffect(() => {
    const location = resolveDefaultUserCityLabel(user?.city);
    if (!location) return;
    setEventFilterCriteria((prev) => {
      if (prev.location.trim()) return prev;
      return { ...prev, location };
    });
  }, [user?.city]);

  useEffect(() => {
    const location = eventFilterCriteria.location.trim();
    if (!location || eventFilterCriteria.latitude != null) return;

    let cancelled = false;
    void resolveEventCoords(location).then((coords) => {
      if (cancelled || !coords) return;
      setEventFilterCriteria((prev) =>
        prev.location.trim() === location && prev.latitude == null
          ? { ...prev, latitude: coords.latitude, longitude: coords.longitude }
          : prev
      );
    });
    return () => {
      cancelled = true;
    };
  }, [eventFilterCriteria.location, eventFilterCriteria.latitude]);

  useEffect(() => {
    const onRefresh = () => setMapEventsRefreshKey((k) => k + 1);
    window.addEventListener(MAP_EVENTS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MAP_EVENTS_REFRESH_EVENT, onRefresh);
  }, []);
  /** Filtre carte « salons » — combinable avec Lives et Évènement. */
  const [showSalonMarkers, setShowSalonMarkers] = useState(false);
  const [mapEvents, setMapEvents] = useState<MapEventMarker[]>([]);
  const [mapEventsRefreshKey, setMapEventsRefreshKey] = useState(0);
  const eventFilterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventFilterLongPressTriggeredRef = useRef(false);
  const [loadingMapEvents, setLoadingMapEvents] = useState(false);
  const [selectedEventCluster, setSelectedEventCluster] = useState<MapEventCityCluster | null>(null);
  /** Centre de la dernière requête api.nearby (pour clip viewport stable). */
  const [nearbyFetchCenter, setNearbyFetchCenter] = useState<[number, number]>(() => [
    ...DEFAULT_CENTER,
  ]);
  const nearbyFetchCenterRef = useRef<[number, number]>([...DEFAULT_CENTER]);
  const livesFilterWasOnRef = useRef(false);

  const [mapDetailState, setMapDetailState] = useState<MapViewDetailState>(() => ({
    tier: getFlatMapDetailTier(14),
    flatZoom: 14,
    globeAltitude: null,
    bounds: null,
    mapStyle: 'flat',
  }));

  useEffect(() => {
    const syncPrefs = () => setNearbyPanelPrefs(getNearbyPanelPreferences());
    const syncMapGeo = () => setMapGeo(getLivesGeo());
    const onMapGeoChanged = () => {
      syncPrefs();
      syncMapGeo();
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, onMapGeoChanged);
    const onOpenCreateSalon = () => setShowCreateSalon(true);
    window.addEventListener(MAP_OPEN_CREATE_SALON_EVENT, onOpenCreateSalon);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, onMapGeoChanged);
      window.removeEventListener(MAP_OPEN_CREATE_SALON_EVENT, onOpenCreateSalon);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setFavoriteIds(new Set());
      return;
    }
    api
      .getMyFavorites(token)
      .then((r) => setFavoriteIds(new Set(r.favorites.map((f) => f.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [token]);

  const viewerTastes = useMemo(
    () => ({
      interests: user?.interests,
      favoriteGenres: user?.favoriteGenres,
      favoriteArtists: user?.favoriteArtists,
    }),
    [user?.interests, user?.favoriteGenres, user?.favoriteArtists]
  );

  const nearbySortOptions = useMemo(
    () => ({
      favoriteIds,
      favoritesFirst: true,
      sortByMusicalAffinity: nearbyPanelPrefs.musicalAffinitiesOnly,
      viewerTastes,
    }),
    [favoriteIds, nearbyPanelPrefs.musicalAffinitiesOnly, viewerTastes]
  );

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  useEffect(() => {
    if (selected && mapPlaybackActive) {
      pauseAllReelsMediaInDom();
      releaseAppMediaFocus('reels');
      requestAppMediaFocus('salon');
    }
  }, [selected?.id, mapPlaybackActive]);

  const filteredNearbyPeople = useMemo(() => {
    const filtered = filterNearbyPeople(nearbyPeople, nearbyPanelPrefs, viewerTastes);
    return sortNearbyPeople(filtered, nearbyPanelPrefs.sortBy, salons, nearbySortOptions);
  }, [
    nearbyPeople,
    salons,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbyPanelPrefs.musicalAffinitiesOnly,
    viewerTastes,
    nearbySortOptions,
  ]);

  const mapPeople = useMemo(() => peopleMarkersOnMap(filteredNearbyPeople), [filteredNearbyPeople]);

  const mapSalons = useMemo(() => {
    const filtered = filterSalonsForMap(salons, filteredNearbyPeople, nearbyPanelPrefs).filter((s) =>
      isValidLatLng(s.latitude, s.longitude)
    );
    return sortSalonsForNearby(filtered, nearbyPanelPrefs.sortBy, nearbySortOptions);
  }, [
    salons,
    filteredNearbyPeople,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbySortOptions,
  ]);

  const mapLives = useMemo(() => {
    const filtered = filterLivesForMap(lives, filteredNearbyPeople, nearbyPanelPrefs).filter((l) =>
      isValidLatLng(l.latitude, l.longitude)
    );
    return sortLivesForNearby(filtered, nearbyPanelPrefs.sortBy, nearbySortOptions);
  }, [
    lives,
    filteredNearbyPeople,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbySortOptions,
  ]);

  /** Filtres carte haut-gauche — toggles indépendants (union des types actifs). */
  const livesFilterOn = nearbyPanelPrefs.livesOnly;
  const salonFilterOn = showSalonMarkers;
  const eventsFilterOn = showEventMarkers;
  const anyMapFilterActive = livesFilterOn || salonFilterOn || eventsFilterOn;

  /**
   * Quand un filtre est actif, forcer l'affichage du point de géolocalisation
   * utilisateur même si le GPS n'est pas disponible (mode ville ou permission refusée).
   * Fallback sur `center` (= position GPS ou centre ville choisie).
   */
  const forceShowDot = anyMapFilterActive;
  const mapUserPosition: [number, number] | null = forceShowDot
    ? (userPosition ?? center)
    : userPosition;

  /** Masque capitales globe/carte plate quand seul le filtre Évènement est actif. */
  const mapEventsOnly = eventsFilterOn && !livesFilterOn && !salonFilterOn;

  const showAllSalonsAtCityZoom = shouldShowAllSalonsAtCityZoom(salonFilterOn);

  const mapSalonsForView = useMemo(() => {
    if (!anyMapFilterActive) return mapSalons;

    const merged = new Map<string, Salon>();
    const addSalons = (list: Salon[]) => {
      for (const salon of list) {
        if (!isValidLatLng(salon.latitude, salon.longitude)) continue;
        merged.set(salon.id, salon);
      }
    };

    if (salonFilterOn) {
      // Salon filter: public salons in the visible viewport (map-browsing mode).
      addSalons(filterSalonsForSalonMapFilter(salons, mapDetailState.bounds));
    } else if (livesFilterOn) {
      addSalons(clipSalonsForMapView(mapSalons, mapDetailState, nearbyFetchCenter));
    }

    return sortSalonsForNearby([...merged.values()], nearbyPanelPrefs.sortBy, nearbySortOptions);
  }, [
    anyMapFilterActive,
    salonFilterOn,
    livesFilterOn,
    salons,
    mapSalons,
    mapDetailState,
    nearbyFetchCenter,
    nearbyPanelPrefs.sortBy,
    nearbySortOptions,
  ]);

  const mapLivesForView = useMemo(() => {
    if (!anyMapFilterActive) return mapLives;
    if (!livesFilterOn) return [];
    return clipLivesForMapView(mapLives, mapDetailState, nearbyFetchCenter);
  }, [anyMapFilterActive, livesFilterOn, mapLives, mapDetailState, nearbyFetchCenter]);

  const mapPeopleForView = useMemo(() => {
    if (!anyMapFilterActive) return mapPeople;
    if (!livesFilterOn) return [];
    return clipPeopleForMapView(mapPeople, mapDetailState, nearbyFetchCenter);
  }, [anyMapFilterActive, livesFilterOn, mapPeople, mapDetailState, nearbyFetchCenter]);
  const filteredMapEvents = useMemo(
    () => filterMapEventsByCriteria(mapEvents, eventFilterCriteria, { viewerId: user?.id }),
    [mapEvents, eventFilterCriteria, user?.id]
  );

  const mapEventClusters = useMemo(
    () => (eventsFilterOn ? clusterMapEventsByCity(filteredMapEvents) : []),
    [eventsFilterOn, filteredMapEvents]
  );

  /**
   * Event clusters clipped to the visible flat-map viewport.
   * On globe or when bounds are unknown the full cluster list is passed through.
   */
  const mapEventClustersForMap = useMemo(() => {
    if (mapDetailState.tier === 'overview') return mapEventClusters;
    if (mapDetailState.mapStyle !== 'flat' || !mapDetailState.bounds) return mapEventClusters;
    return filterEventClustersInViewport(
      mapEventClusters,
      mapDetailState.bounds,
      mapDetailState.tier
    );
  }, [mapEventClusters, mapDetailState.mapStyle, mapDetailState.bounds, mapDetailState.tier]);

  /** Panneau ville : événements filtrés par viewport au zoom ville / rue. */
  const selectedEventClusterForPanel = useMemo(() => {
    if (!selectedEventCluster) return null;
    if (
      mapDetailState.mapStyle !== 'flat' ||
      !mapDetailState.bounds ||
      mapDetailState.tier === 'overview'
    ) {
      return selectedEventCluster;
    }
    const eventsInView = filterMarkersInViewport(
      selectedEventCluster.events,
      mapDetailState.bounds
    );
    return {
      ...selectedEventCluster,
      events: eventsInView,
      count: eventsInView.length,
    };
  }, [selectedEventCluster, mapDetailState.mapStyle, mapDetailState.bounds, mapDetailState.tier]);

  const mapSidebarContent = useMemo(
    () =>
      buildMapSidebarContent({
        detail: mapDetailState,
        eventsFilterOn,
        livesFilterOn,
        salonFilterOn,
        eventsOnly: mapEventsOnly,
        showAllSalonsAtCityZoom,
        mapEvents: filteredMapEvents,
        eventClusters: mapEventClusters,
        lives: mapLives,
        salons: mapSalons,
        people: mapPeople,
        favoriteIds,
        nearbyFetchCenter,
      }),
    [
      mapDetailState,
      eventsFilterOn,
      livesFilterOn,
      salonFilterOn,
      showAllSalonsAtCityZoom,
      mapEventsOnly,
      filteredMapEvents,
      mapEventClusters,
      mapLives,
      mapSalons,
      mapPeople,
      favoriteIds,
      nearbyFetchCenter,
    ]
  );

  const mapSidebarItemCount = useMemo(
    () => countMapSidebarItems(mapSidebarContent),
    [mapSidebarContent]
  );

  /** Badge filtre Salon : salons publics visibles (zone + zoom), pas le total global. */
  const salonFilterBadgeCount = salonFilterOn ? mapSidebarContent.salons.length : 0;

  /** Badge filtre Évènement : clusters ou événements individuels dans la zone visible. */
  const eventsFilterBadgeCount = eventsFilterOn
    ? mapSidebarContent.eventClusters.length + mapSidebarContent.events.length
    : 0;

  const liveSalonMarkerCount = useMemo(
    () => (livesFilterOn && !salonFilterOn ? mapSalonsForView.filter((s) => s.isLive).length : 0),
    [livesFilterOn, salonFilterOn, mapSalonsForView]
  );

  const livesFilterBadgeCount = useMemo(
    () =>
      countLivesFilterBadge(
        livesFilterOn,
        salonFilterOn,
        mapSidebarContent,
        liveSalonMarkerCount
      ),
    [livesFilterOn, salonFilterOn, mapSidebarContent, liveSalonMarkerCount]
  );

  const mapDetailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapDetailPendingRef = useRef<MapViewDetailState | null>(null);

  useEffect(() => {
    return () => {
      if (mapDetailDebounceRef.current) clearTimeout(mapDetailDebounceRef.current);
    };
  }, []);

  const handleMapDetailStateChange = useCallback((state: MapViewDetailState) => {
    setMapDetailState((prev) => {
      if (mapSidebarDetailEqual(prev, state)) return prev;

      const tierOrStyleChanged = prev.tier !== state.tier || prev.mapStyle !== state.mapStyle;
      if (tierOrStyleChanged) {
        if (mapDetailDebounceRef.current) {
          clearTimeout(mapDetailDebounceRef.current);
          mapDetailDebounceRef.current = null;
        }
        mapDetailPendingRef.current = null;
        return state;
      }

      // Same tier/style: debounce bounds-only pan updates (sidebar filter by viewport).
      if (state.mapStyle === 'flat' && state.bounds) {
        mapDetailPendingRef.current = state;
        if (!mapDetailDebounceRef.current) {
          mapDetailDebounceRef.current = setTimeout(() => {
            mapDetailDebounceRef.current = null;
            const pending = mapDetailPendingRef.current;
            mapDetailPendingRef.current = null;
            if (pending) {
              setMapDetailState((p) => (mapSidebarDetailEqual(p, pending) ? p : pending));
            }
          }, 180);
        }
        return prev;
      }

      return state;
    });
  }, []);

  const nearbyQueryCenter = useMemo(
    () => getNearbyQueryCenter(userPosition, center),
    [userPosition, center, mapGeo.latitude, mapGeo.longitude, mapGeo.source]
  );

  const setNearbyPeopleVisible = useCallback((visible: boolean) => {
    setShowNearbyPeople(visible);
    localStorage.setItem(NEARBY_PEOPLE_STORAGE_KEY, visible ? 'true' : 'false');
  }, []);

  const toggleMapStyle = useCallback(() => {
    const next: MapStyle = mapStyle === 'flat' ? 'globe' : 'flat';
    setMapStyle(next);
    localStorage.setItem(MAP_STYLE_KEY, next);
  }, [mapStyle]);

  /** Filtres carte haut-gauche : Lives, Salon et Évènement — toggles indépendants. */
  const toggleLivesFilter = useCallback(() => {
    setNearbyPanelPreferences({ livesOnly: !nearbyPanelPrefs.livesOnly });
  }, [nearbyPanelPrefs.livesOnly]);

  const toggleSalonFilter = useCallback(() => {
    setShowSalonMarkers((on) => !on);
  }, []);

  const disableEventsFilter = useCallback(() => {
    setSelectedEventCluster(null);
    setShowEventMarkers(false);
    setShowEventFilterSheet(false);
  }, []);

  const openEventFilterSheet = useCallback(() => {
    setShowEventFilterSheet(true);
  }, []);

  const flyToEventFilterBounds = useCallback((criteria: MapEventFilterCriteria) => {
    if (criteria.location.trim() && criteria.latitude != null && criteria.longitude != null) {
      mapViewRef.current?.flyToCityBounds(
        criteria.latitude,
        criteria.longitude,
        criteria.radiusKm
      );
    }
  }, []);

  const applyEventFilter = useCallback((criteria: MapEventFilterCriteria) => {
    setEventFilterCriteria(criteria);
    setShowEventMarkers(true);
    setShowEventFilterSheet(false);
    flyToEventFilterBounds(criteria);
  }, [flyToEventFilterBounds]);

  const toggleEventsFilter = useCallback(() => {
    if (showEventMarkers) {
      disableEventsFilter();
      return;
    }
    openEventFilterSheet();
  }, [showEventMarkers, disableEventsFilter, openEventFilterSheet]);

  const onEventFilterPointerDown = useCallback(() => {
    eventFilterLongPressTriggeredRef.current = false;
    if (eventFilterLongPressRef.current) clearTimeout(eventFilterLongPressRef.current);
    eventFilterLongPressRef.current = setTimeout(() => {
      eventFilterLongPressTriggeredRef.current = true;
      openEventFilterSheet();
    }, 600);
  }, [openEventFilterSheet]);

  const onEventFilterPointerUp = useCallback(() => {
    if (eventFilterLongPressRef.current) {
      clearTimeout(eventFilterLongPressRef.current);
      eventFilterLongPressRef.current = null;
    }
  }, []);

  const onEventFilterClick = useCallback(() => {
    if (eventFilterLongPressTriggeredRef.current) {
      eventFilterLongPressTriggeredRef.current = false;
      return;
    }
    toggleEventsFilter();
  }, [toggleEventsFilter]);

  useEffect(() => {
    if (!showEventMarkers || !token) {
      if (!showEventMarkers) setMapEvents([]);
      return;
    }

    let cancelled = false;
    setLoadingMapEvents(true);

    loadMapEventMarkers(token, { signal: { cancelled } })
      .then((markers) => {
        if (!cancelled) setMapEvents(markers);
      })
      .catch(() => {
        if (!cancelled) {
          setMapEvents([]);
          setToastMsg('Impossible de charger les événements sur la carte');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMapEvents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showEventMarkers, token, mapEventsRefreshKey]);

  const handleGlobeZoomToFlat = useCallback(
    (
      lat: number,
      lng: number,
      doSelect: () => void,
      zoom?: number,
      radiusKm?: number,
      animated?: boolean
    ) => {
      // Repositionne la carte Leaflet (cachée) avant le crossfade
      if (radiusKm != null && radiusKm > 0) {
        mapViewRef.current?.jumpToCityBounds(lat, lng, radiusKm);
      } else if (animated) {
        mapViewRef.current?.flyTo(lat, lng, zoom ?? 13);
      } else {
        mapViewRef.current?.jumpTo(lat, lng, zoom ?? 14);
      }
      setMapStyle('flat');
      localStorage.setItem(MAP_STYLE_KEY, 'flat');
      setCenter(sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER));
      // Délai aligné sur le crossfade MapView (500 ms)
      setTimeout(doSelect, 560);
    },
    []
  );

  const handleAutoSwitchToGlobe = useCallback(() => {
    setMapStyle('globe');
    localStorage.setItem(MAP_STYLE_KEY, 'globe');
  }, []);

  // Ref holding the debounce timer for settings-triggered reloads.
  const nearbyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce playback_sync socket events (fires ~every second) to limit re-renders.
  const playbackSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for the 20s geo-refresh interval — allows explicit pause/resume on visibility change.
  const geoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyNearbyResponse = useCallback((coords: [number, number], r: {
    salons: Salon[];
    lives: Live[];
    people?: NearbyPerson[];
  }) => {
    const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
    nearbyFetchCenterRef.current = safe;
    setNearbyFetchCenter(safe);
    setSalons(r.salons);
    setLives(r.lives);
    setNearbyPeople(r.people ?? []);
  }, []);

  const loadNearbyAt = useCallback((
    coords: [number, number],
    opts?: { updateUserGeo?: boolean }
  ) => {
    const [lat, lon] = coords;
    if (!token || !isValidLatLng(lat, lon)) return;
    const prefs = getNearbyPanelPreferences();
    const radius = getNearbyRadiusKm();
    setLoadingNearby(true);
    const runNearby = () =>
      api
        .nearby(token, lat, lon, {
          radiusKm: radius,
          distanceFilter: isNearbyDistanceFilterActive(prefs),
        })
        .then((r) => applyNearbyResponse([lat, lon], r))
        .finally(() => setLoadingNearby(false));

    if (opts?.updateUserGeo === false) {
      runNearby();
      return;
    }
    api
      .updateGeo(token, lat, lon)
      .catch(() => {})
      .finally(runNearby);
  }, [token, applyNearbyResponse]);

  const loadNearby = useCallback((lat: number, lon: number) => {
    loadNearbyAt(sanitizeLatLngTuple(lat, lon, DEFAULT_CENTER));
  }, [loadNearbyAt]);

  const loadNearbyFromState = useCallback((
    userPos: [number, number] | null,
    mapCenter: [number, number]
  ) => {
    loadNearbyAt(getNearbyQueryCenter(userPos, mapCenter));
  }, [loadNearbyAt]);

  /** Debounced version of loadNearbyFromState for settings/prefs events
   *  (avoids firing multiple times in rapid succession). */
  const loadNearbyFromStateDebounced = useCallback((
    userPos: [number, number] | null,
    mapCenter: [number, number]
  ) => {
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    nearbyDebounceRef.current = setTimeout(() => {
      loadNearbyAt(getNearbyQueryCenter(userPos, mapCenter));
    }, 500);
  }, [loadNearbyAt]);

  useEffect(() => {
    if (!token) return;

    const geo = getLivesGeo();
    const { locationSharing } = getPrivacyPreferences();

    if (isFixedMapGeoSource(geo.source)) {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      setSafeCenter(coords);
      loadNearbyAt(coords);
    } else if (!navigator.geolocation || !locationSharing) {
      loadNearbyFromState(null, center);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const coords: [number, number] = [lat, lon];
          setSafeCenter(coords);
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER));
          loadNearbyAt(coords);
        },
        () => loadNearbyFromState(null, center)
      );
    }

    // Unified 20s refresh: re-reads the current source and locationSharing on every
    // tick so mode switches (city ↔ GPS) and privacy changes are picked up without
    // restarting the effect.
    const startGeoInterval = () => {
      if (geoIntervalRef.current) return;
      geoIntervalRef.current = setInterval(() => {
        const current = getLivesGeo();
        const { locationSharing: sharing } = getPrivacyPreferences();
        if (isFixedMapGeoSource(current.source)) {
          loadNearbyAt([current.latitude, current.longitude]);
          return;
        }
        if (!navigator.geolocation || !sharing) {
          loadNearbyAt([current.latitude, current.longitude], { updateUserGeo: false });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => loadNearbyAt([pos.coords.latitude, pos.coords.longitude]),
          () => loadNearbyAt([current.latitude, current.longitude])
        );
      }, 20000);
    };

    const stopGeoInterval = () => {
      if (geoIntervalRef.current) {
        clearInterval(geoIntervalRef.current);
        geoIntervalRef.current = null;
      }
    };

    startGeoInterval();

    // Stop tracking when the tab/window is closed.
    const handleBeforeUnload = () => stopGeoInterval();
    // Pause tracking when the tab is hidden, resume when it becomes visible again.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopGeoInterval();
      } else {
        startGeoInterval();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopGeoInterval();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    const onMapGeo = () => {
      const geo = getLivesGeo();
      if (isFixedMapGeoSource(geo.source)) {
        setSafeCenter([geo.latitude, geo.longitude]);
        setUserPosition(null);
        loadNearby(geo.latitude, geo.longitude);
        return;
      }
      if (!navigator.geolocation) {
        loadNearby(geo.latitude, geo.longitude);
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setSafeCenter(coords);
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1]));
          loadNearby(coords[0], coords[1]);
          setLocating(false);
        },
        () => {
          setLocating(false);
          setSafeCenter([geo.latitude, geo.longitude]);
          loadNearby(geo.latitude, geo.longitude);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      );
    };
    window.addEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
  }, [token]);

  useEffect(() => {
    const reloadFromPrefs = () => {
      loadNearbyFromStateDebounced(userPosition, center);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    };
  }, [token, userPosition, center, loadNearbyFromStateDebounced]);

  /** Ignore bounds-driven nearby reloads pendant flyTo programmé (center prop). */
  const programmaticMapMoveUntilRef = useRef(0);
  useEffect(() => {
    programmaticMapMoveUntilRef.current = Date.now() + 900;
  }, [center]);

  /** Rechargement nearby en attente (filtre Lives ON avant bounds / globe prêts). */
  const pendingLivesNearbyReloadRef = useRef(false);
  const lastGlobeNearbyRef = useRef<{ lat: number; lon: number } | null>(null);

  const resolveLivesNearbyQueryCenter = useCallback((): [number, number] | null => {
    if (mapDetailState.mapStyle === 'flat' && mapDetailState.bounds) {
      return getMapBoundsCenter(mapDetailState.bounds);
    }
    if (mapDetailState.mapStyle === 'globe') {
      return sanitizeLatLngTuple(center[0], center[1], DEFAULT_CENTER);
    }
    return null;
  }, [mapDetailState.mapStyle, mapDetailState.bounds, center]);

  useEffect(() => {
    if (livesFilterOn) {
      pendingLivesNearbyReloadRef.current = true;
      return;
    }
    pendingLivesNearbyReloadRef.current = false;
    lastGlobeNearbyRef.current = null;
  }, [livesFilterOn]);

  /** Filtre Lives ON : recharger nearby dès que le centre requête est connu (flat ou globe). */
  useEffect(() => {
    if (!livesFilterOn || !token || !pendingLivesNearbyReloadRef.current) return;
    const queryCenter = resolveLivesNearbyQueryCenter();
    if (!queryCenter) return;
    pendingLivesNearbyReloadRef.current = false;
    loadNearbyAt(queryCenter, { updateUserGeo: false });
    if (mapDetailState.mapStyle === 'globe') {
      lastGlobeNearbyRef.current = { lat: queryCenter[0], lon: queryCenter[1] };
    }
  }, [livesFilterOn, mapDetailState, token, loadNearbyAt, resolveLivesNearbyQueryCenter]);

  /** Filtre Lives : recharger nearby au centre viewport (carte plate, sans updateGeo). */
  useEffect(() => {
    if (!livesFilterOn || !token) return;
    if (mapDetailState.mapStyle !== 'flat' || !mapDetailState.bounds) return;
    if (pendingLivesNearbyReloadRef.current) return;
    if (Date.now() < programmaticMapMoveUntilRef.current) return;

    const viewportCenter = getMapBoundsCenter(mapDetailState.bounds);
    const anchor = nearbyFetchCenterRef.current;
    const viewportStale = !shouldClipMapMarkersToViewport(mapDetailState, anchor);

    if (!viewportStale) {
      const radiusKm = getNearbyRadiusKm();
      const minDeltaKm = Math.max(5, radiusKm * 0.3);
      const movedKm = getDistanceKm(
        viewportCenter[0],
        viewportCenter[1],
        anchor[0],
        anchor[1]
      );
      if (movedKm < minDeltaKm) return;
    }

    loadNearbyAt(viewportCenter, { updateUserGeo: false });
  }, [livesFilterOn, mapDetailState, token, loadNearbyAt]);

  /** Filtre Lives + globe : recharger nearby quand l'utilisateur tourne/zoom le globe (zoom ville). */
  const handleGlobePovChange = useCallback(
    (lat: number, lng: number, altitude: number) => {
      if (!livesFilterOn || !token || altitude >= GLOBE_ALTITUDE_CITY_MAX) return;
      if (!isValidLatLng(lat, lng)) return;
      if (Date.now() < programmaticMapMoveUntilRef.current) return;

      const prev = lastGlobeNearbyRef.current;
      const radiusKm = getNearbyRadiusKm();
      const minDeltaKm = Math.max(5, radiusKm * 0.3);
      if (prev) {
        const movedKm = getDistanceKm(lat, lng, prev.lat, prev.lon);
        if (movedKm < minDeltaKm) return;
      }

      lastGlobeNearbyRef.current = { lat, lon: lng };
      loadNearbyAt([lat, lng], { updateUserGeo: false });
    },
    [livesFilterOn, token, loadNearbyAt]
  );

  /** Désactivation filtre Lives : revenir aux données GPS / centre carte. */
  useEffect(() => {
    if (livesFilterOn) {
      livesFilterWasOnRef.current = true;
      return;
    }
    if (!livesFilterWasOnRef.current || !token) return;
    livesFilterWasOnRef.current = false;
    loadNearbyFromState(userPosition, center);
  }, [livesFilterOn, token, userPosition, center, loadNearbyFromState]);

  const recenterLabel = isFixedMapGeoSource(mapGeo.source)
    ? `Recentrer sur ${mapGeo.label}`
    : 'Recentrer sur ma position';

  const recenterMap = useCallback(() => {
    const geo = getLivesGeo();

    const zoomToLocation = (coords: [number, number], zoom: number): [number, number] => {
      const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
      if (mapStyle === 'globe') {
        mapViewRef.current?.jumpTo(safe[0], safe[1], zoom);
        setMapStyle('flat');
        localStorage.setItem(MAP_STYLE_KEY, 'flat');
      } else {
        mapViewRef.current?.flyTo(safe[0], safe[1], zoom);
      }
      setSafeCenter(safe);
      return safe;
    };

    if (isFixedMapGeoSource(geo.source)) {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      zoomToLocation(coords, MAP_RECENTER_ZOOM_CITY);
      loadNearby(geo.latitude, geo.longitude);
      return;
    }

    const doRecenter = (coords: [number, number]) => {
      const safe = zoomToLocation(coords, MAP_RECENTER_ZOOM_GPS);
      setUserPosition(safe);
      loadNearbyAt(safe);
    };

    if (userPosition) {
      doRecenter(userPosition);
      return;
    }

    if (!navigator.geolocation) {
      doRecenter([geo.latitude, geo.longitude]);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doRecenter([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        doRecenter([geo.latitude, geo.longitude]);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  }, [userPosition, loadNearby, loadNearbyAt, setSafeCenter, mapStyle]);

  const dismissSalonSheetOnly = useCallback(() => {
    setSelected((prev) => {
      if (prev?.id) clearMapInlineListenSession(prev.id);
      return null;
    });
    setSalonSheetExpanded(false);
    clearSalonUrlFromBar();
  }, []);

  const dismissLiveSheetOnly = useCallback(() => {
    setSelectedLive(null);
  }, []);

  const flyMapTo = useCallback((lat: number, lng: number) => {
    if (isValidLatLng(lat, lng)) {
      mapViewRef.current?.flyTo(lat, lng, MAP_LIVE_ZOOM);
    }
  }, []);

  const flyMapToCity = useCallback((cluster: MapEventCityCluster) => {
    const { radiusKm } = getCityMapView(cluster.cityKey);
    if (isValidLatLng(cluster.latitude, cluster.longitude)) {
      mapViewRef.current?.flyToCityBounds(cluster.latitude, cluster.longitude, radiusKm);
    }
  }, []);

  const handleMapEventClusterClick = useCallback(
    (cluster: MapEventCityCluster) => {
      flyMapToCity(cluster);
      setSelectedEventCluster(cluster);
      setNearbyPeopleVisible(true);
      if (nearbyPanelPrefs.livesOnly && isValidLatLng(cluster.latitude, cluster.longitude)) {
        loadNearbyAt([cluster.latitude, cluster.longitude], { updateUserGeo: false });
      }
    },
    [flyMapToCity, setNearbyPeopleVisible, nearbyPanelPrefs.livesOnly, loadNearbyAt]
  );

  const handleCityEventClick = useCallback(
    (event: MapEventMarker) => {
      onOpenFeedPost?.(event.id);
    },
    [onOpenFeedPost]
  );

  const clearEventClusterSelection = useCallback(() => {
    setSelectedEventCluster(null);
  }, []);

  const trySelectSalon = useCallback(async (
    salon: Salon,
    opts?: { closeMapProfile?: boolean }
  ): Promise<boolean> => {
    if (salon.canJoin === false && salon.hostId !== user?.id) {
      setToastMsg('Salon sur invitation uniquement — le host doit vous autoriser');
      return false;
    }
    if (opts?.closeMapProfile) {
      onCloseMapProfile?.();
    }
    setSelectedLive(null);
    setSelected(salon);
    setSalonSheetExpanded(false);
    if (token && salon.canJoin !== true && salon.hostId !== user?.id) {
      try {
        await api.joinSalon(token, salon.id);
      } catch (e) {
        setSelected(null);
        setToastMsg(e instanceof Error ? e.message : 'Accès refusé');
        return false;
      }
    }
    return true;
  }, [user?.id, token, onCloseMapProfile]);

  const resolveSalonById = useCallback(async (salonId: string): Promise<Salon | null> => {
    const local = salons.find((s) => s.id === salonId);
    if (local) return local;
    if (!token) return null;
    try {
      const { salon: fetched } = await api.getSalon(token, salonId);
      setSalons((prev) => (prev.some((s) => s.id === fetched.id) ? prev : [...prev, fetched]));
      return fetched;
    } catch {
      return null;
    }
  }, [salons, token]);

  /** salonId sur la personne, cache hôte, puis profil public si besoin. */
  const resolveSalonIdForPerson = useCallback(async (person: NearbyPerson): Promise<string | null> => {
    if (person.salonId) return person.salonId;
    const cached = salons.find((s) => s.hostId === person.id)?.id;
    if (cached) return cached;
    if (!token) return null;
    try {
      const { user: profile } = await api.getUserProfile(token, person.id);
      return profile.salonId ?? null;
    } catch {
      return null;
    }
  }, [salons, token]);

  const resolveLiveForPerson = useCallback(async (person: NearbyPerson): Promise<Live | null> => {
    if (!person.isLive || !person.liveId) return null;
    const cached = lives.find((l) => l.id === person.liveId);
    if (cached) return cached;
    const synthetic = liveFromNearbyPerson(person, person.liveId);
    if (synthetic) return synthetic;
    if (!token) return null;
    try {
      const { live } = await api.getLive(token, person.liveId);
      setLives((prev) => (prev.some((l) => l.id === live.id) ? prev : [...prev, live]));
      return live;
    } catch {
      return null;
    }
  }, [lives, token]);

  /** Sélectionne un salon par id dans la bottom sheet carte (ne navigue PAS vers SalonPage). */
  const openSalonOnMap = useCallback(async (salonId: string): Promise<boolean> => {
    const salon = await resolveSalonById(salonId);
    if (!salon) return false;
    flyMapTo(salon.latitude, salon.longitude);
    return trySelectSalon(salon, { closeMapProfile: true });
  }, [resolveSalonById, trySelectSalon, flyMapTo]);

  const restoreSalonOnMap = useCallback(async (salonId: string) => {
    const salon = await resolveSalonById(salonId);
    if (!salon) return;
    flyMapTo(salon.latitude, salon.longitude);
    dismissLiveSheetOnly();
    await trySelectSalon(salon, { closeMapProfile: true });
  }, [resolveSalonById, flyMapTo, dismissLiveSheetOnly, trySelectSalon]);

  useEffect(() => {
    if (!restoreSalonId) return;
    void restoreSalonOnMap(restoreSalonId).finally(() => onSalonMapRestored?.());
  }, [restoreSalonId, restoreSalonOnMap, onSalonMapRestored]);

  const openLiveOnMap = useCallback((live: Live) => {
    void (async () => {
      flyMapTo(live.latitude, live.longitude);

      let salon = findSalonForLive(live, salons);
      if (!salon && live.salonId) {
        salon = (await resolveSalonById(live.salonId)) ?? undefined;
      }
      if (salon) {
        const opened = await trySelectSalon(salon, { closeMapProfile: true });
        if (opened) return;
      }

      onCloseMapProfile?.();
      setSelected(null);
      setSalonSheetExpanded(false);
      setSelectedLive(live);
    })();
  }, [salons, resolveSalonById, trySelectSalon, flyMapTo, onCloseMapProfile]);

  /** Clic personne (carte ou liste) : salon replié en priorité, sinon live (jamais profil). */
  const openNearbyPerson = useCallback((person: NearbyPerson) => {
    void (async () => {
      onCloseMapProfile?.();
      setSelectedLive(null);

      const salonId = await resolveSalonIdForPerson(person);
      if (salonId) {
        await openSalonOnMap(salonId);
        return;
      }

      if (person.isLive && person.liveId) {
        const live = await resolveLiveForPerson(person);
        if (live) openLiveOnMap(live);
      }
    })();
  }, [resolveLiveForPerson, resolveSalonIdForPerson, openLiveOnMap, openSalonOnMap, onCloseMapProfile]);

  const handleMapPersonClick = useCallback((person: NearbyPerson) => {
    openNearbyPerson(person);
  }, [openNearbyPerson]);

  const handleMapLiveClick = useCallback((l: Live) => {
    openLiveOnMap(l);
  }, [openLiveOnMap]);

  const handleMapBackgroundClick = useCallback(() => {
    if (selectedEventCluster) setSelectedEventCluster(null);
    if (mapProfileOpen) onCloseMapProfile?.();
  }, [mapProfileOpen, onCloseMapProfile, selectedEventCluster]);

  const handleMapSalonClick = useCallback((salon: Salon) => {
    flyMapTo(salon.latitude, salon.longitude);
    dismissLiveSheetOnly();
    void trySelectSalon(salon, { closeMapProfile: true });
  }, [trySelectSalon, flyMapTo, dismissLiveSheetOnly]);

  const closeSalonSheet = useCallback(() => {
    dismissSalonSheetOnly();
    onCloseMapProfile?.();
  }, [dismissSalonSheetOnly, onCloseMapProfile]);

  const closeLiveSheet = useCallback(() => {
    dismissLiveSheetOnly();
    onCloseMapProfile?.();
  }, [dismissLiveSheetOnly, onCloseMapProfile]);

  const closeMapSheet = useCallback(() => {
    if (selectedLive) closeLiveSheet();
    else closeSalonSheet();
  }, [selectedLive, closeLiveSheet, closeSalonSheet]);

  const onSalonCreated = useCallback((salon: Salon, lat: number, lon: number) => {
    setShowCreateSalon(false);
    setSalons((s) => [...s, salon]);
    setSelected(null);
    setSalonSheetExpanded(false);
    setSafeCenter([lat, lon]);
    loadNearby(lat, lon);
    onOpenSalon?.(salon.id);
  }, [loadNearby, onOpenSalon, setSafeCenter]);

  useEffect(() => {
    if (!selected || !token || !user) return;
    if (selected.canJoin === false && selected.hostId !== user.id) return;
    const salonId = selected.id;
    const socket = getSocket();
    const joinSalon = () => {
      socket.emit('join_salon', { salonId, userId: user.id, username: user.username });
    };
    joinSalon();
    const offReconnect = onSocketConnect(joinSalon);
    const onDenied = ({ salonId: deniedId }: { salonId: string }) => {
      if (deniedId === salonId) {
        setSelected(null);
        setToastMsg('Accès refusé à ce salon');
      }
    };
    const onKicked = ({ salonId: kickedId }: { salonId: string }) => {
      if (kickedId === salonId) setSelected(null);
    };
    const onBanned = ({ salonId: bannedId }: { salonId: string }) => {
      if (bannedId === salonId) setSelected(null);
    };
    const onSalonUpdated = (updated: Salon) => {
      if (updated.id !== salonId) return;
      setSelected((prev) => {
        if (!prev) return prev;
        const { playbackState: incomingPs, queue: incomingQueue, ...rest } = updated;
        return {
          ...prev,
          ...rest,
          playbackState: incomingPs
            ? mergeRemotePlaybackState(prev.playbackState, incomingPs)
            : prev.playbackState,
          queue: incomingQueue ?? prev.queue,
        };
      });
    };
    const onPlaybackSync = (state: PlaybackState) => {
      if (playbackSyncDebounceRef.current) clearTimeout(playbackSyncDebounceRef.current);
      playbackSyncDebounceRef.current = setTimeout(() => {
        setSelected((prev) =>
          prev && prev.id === salonId
            ? { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) }
            : prev
        );
      }, 80);
    };
    socket.on('salon_join_denied', onDenied);
    socket.on('salon_kicked', onKicked);
    socket.on('salon_banned', onBanned);
    socket.on('salon_updated', onSalonUpdated);
    socket.on('playback_sync', onPlaybackSync);
    socket.on('salon_playback', onPlaybackSync);
    return () => {
      offReconnect();
      if (playbackSyncDebounceRef.current) clearTimeout(playbackSyncDebounceRef.current);
      socket.emit('leave_salon', { salonId });
      socket.off('salon_join_denied', onDenied);
      socket.off('salon_kicked', onKicked);
      socket.off('salon_banned', onBanned);
      socket.off('salon_updated', onSalonUpdated);
      socket.off('playback_sync', onPlaybackSync);
      socket.off('salon_playback', onPlaybackSync);
    };
  }, [selected?.id, selected?.canJoin, user?.id, user?.username, token]);

  const handleMapInlineListenCapReached = useCallback(() => {
    setToastMsg('Aperçu carte : 10 min atteintes — ouvrez le salon pour continuer');
  }, []);

  const openSalonFullFromSheet = useCallback(
    (salonId: string) => {
      if (!onOpenSalon) {
        setToastMsg('Ouverture du salon indisponible');
        setSalonSheetExpanded(true);
        return;
      }
      clearMapInlineListenSession(salonId);
      onOpenSalon(salonId);
    },
    [onOpenSalon]
  );

  const openHostProfileFromSheet = useCallback(() => {
    if (!selected) return;
    const person = nearbyPeople.find((p) => p.id === selected.hostId);
    onOpenProfile(
      person ?? {
        id: selected.hostId,
        username: selected.hostName,
        avatarUrl: selected.hostAvatarUrl,
        salonId: selected.id,
        salonTitle: selected.title,
        listeningPlatform: selected.platform,
        listenersCount: selected.listenersCount,
        isBot: selected.isBot,
      }
    );
  }, [selected, nearbyPeople, onOpenProfile]);

  const openHostProfileFromLiveSheet = useCallback(() => {
    if (!selectedLive) return;
    const person = nearbyPeople.find((p) => p.id === selectedLive.hostId);
    onOpenProfile(
      person ?? {
        id: selectedLive.hostId,
        username: selectedLive.hostName,
        isLive: true,
        liveId: selectedLive.id,
        liveViewersCount: selectedLive.viewersCount,
        listeningPlatform: selectedLive.platform,
        salonId: selectedLive.salonId,
        salonTitle: selectedLive.title,
      }
    );
  }, [selectedLive, nearbyPeople, onOpenProfile]);

  const mapSheetOpen = Boolean(selected || selectedLive);

  return (
    <div className={`relative flex-1 flex min-h-0 ${appa2 ? 'flex-col' : 'flex-row'}`}>
      {token && (
        <MapEventFilterSheet
          open={showEventFilterSheet}
          initialCriteria={eventFilterCriteria}
          profileCity={user?.city}
          onClose={() => setShowEventFilterSheet(false)}
          onApply={applyEventFilter}
        />
      )}

      {token && user && (
        <CreateSalonModal
          token={token}
          username={user.username}
          connectedPlatforms={user.connectedPlatforms}
          open={showCreateSalon}
          fallbackLatitude={nearbyQueryCenter[0]}
          fallbackLongitude={nearbyQueryCenter[1]}
          onClose={() => setShowCreateSalon(false)}
          onCreated={onSalonCreated}
          onUserUpdated={setUserFromProfile}
        />
      )}

      {!appa2 && showNearbyPeople ? (
        showEventMarkers && selectedEventCluster && !livesFilterOn ? (
          <MapCityEventsPanel
            layout="side"
            cluster={selectedEventClusterForPanel ?? selectedEventCluster}
            detailTier={mapDetailState.tier}
            favoriteIds={favoriteIds}
            onEventClick={handleCityEventClick}
            onBack={clearEventClusterSelection}
            onHide={() => setNearbyPeopleVisible(false)}
          />
        ) : (
          <NearbyPeoplePanel
            layout="side"
            content={mapSidebarContent}
            detail={mapDetailState}
            loading={loadingNearby}
            eventsLoading={showEventMarkers && loadingMapEvents}
            selectedSalonId={selected?.id}
            onPersonClick={openNearbyPerson}
            onSalonClick={handleMapSalonClick}
            onLiveClick={openLiveOnMap}
            onHide={() => setNearbyPeopleVisible(false)}
            onEventClick={handleCityEventClick}
            onEventClusterClick={handleMapEventClusterClick}
            eventsFilterOn={eventsFilterOn}
            livesFilterOn={livesFilterOn}
            salonFilterOn={salonFilterOn}
          />
        )
      ) : !appa2 ? (
        <button
          type="button"
          onClick={() => setNearbyPeopleVisible(true)}
          title="Afficher la liste carte"
          aria-label="Afficher la liste carte"
          className="shrink-0 z-20 flex flex-col items-center justify-center gap-1 w-10 sm:w-11 bg-[var(--ms-surface)]/95 border-r border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
          </svg>
          <span className="text-[8px] font-bold uppercase hidden sm:block">Liste</span>
          {anyMapFilterActive && mapSidebarItemCount > 0 && (
            <span className="text-[9px] font-bold bg-purple-600/80 text-white px-1.5 py-0.5 rounded-full min-w-[1.1rem]">
              {mapSidebarItemCount}
            </span>
          )}
        </button>
      ) : null}

      <div className="relative flex-1 min-w-0 flex flex-col min-h-0">
        {!appa2 && !mapProfileOpen && (
          <MapAdBanner onCtaSalon={() => setShowCreateSalon(true)} onCtaLive={onOpenLiveTab} />
        )}

        <div className="relative flex-1 min-h-0">
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="px-4 py-2.5 rounded-xl bg-[#1a1a26] border border-white/15 text-sm text-white shadow-lg whitespace-nowrap">
              {toastMsg}
            </div>
          </div>
        )}
        <MapView
          ref={mapViewRef}
          salons={mapSalonsForView}
          lives={mapLivesForView}
          people={mapPeopleForView}
          eventClusters={mapEventClustersForMap}
          hasEventClusters={mapEventClusters.length > 0}
          eventsOnly={mapEventsOnly}
          showAllSalonsAtCityZoom={showAllSalonsAtCityZoom}
          center={center}
          userPosition={mapUserPosition ?? undefined}
          onSelectSalon={handleMapSalonClick}
          onSelectLive={handleMapLiveClick}
          onSelectPerson={handleMapPersonClick}
          onSelectEventCluster={handleMapEventClusterClick}
          onMapBackgroundClick={handleMapBackgroundClick}
          mapStyle={mapStyle}
          onGlobeZoomToFlat={handleGlobeZoomToFlat}
          onAutoSwitchToGlobe={handleAutoSwitchToGlobe}
          onMapDetailStateChange={handleMapDetailStateChange}
          onGlobePovChange={handleGlobePovChange}
          livesFilterOn={livesFilterOn}
          salonFilterOn={salonFilterOn}
          eventsFilterOn={eventsFilterOn}
        />
        {mapStyle === 'globe' && (
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,15,0.65) 100%)' }}
          />
        )}

        {mapSheetOpen && (
          <button
            type="button"
            className="absolute inset-0 z-[25] bg-black/45 pointer-events-auto"
            onClick={closeMapSheet}
            aria-label="Fermer la fiche"
          />
        )}

        {token && !mapProfileOpen && (
          <div className="absolute bottom-4 left-3 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowCreateSalon(true)}
              aria-label="Créer un salon musical"
              className="px-5 py-2.5 sm:py-3 rounded-full bg-[#12121a] border border-[#2d2d3d] hover:border-purple-500/60 font-extrabold text-sm sm:text-base shadow-lg shadow-black/30 whitespace-nowrap active:scale-95 transition shrink-0 min-w-[5.5rem] sm:min-w-[6.5rem]"
            >
              <span className={USERNAME_WAVE_CLASS}>+ Salon</span>
            </button>
          </div>
        )}

        <div className="absolute bottom-4 right-3 z-30 flex flex-row items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={recenterMap}
            disabled={locating}
            title={recenterLabel}
            aria-label={recenterLabel}
            className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#12121a] border border-[#2d2d3d] hover:border-indigo-500/60 text-indigo-400 shadow-lg disabled:opacity-50 active:scale-95 transition shrink-0"
          >
            {locating ? (
              <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        <div className="absolute top-3 left-3 z-30 inline-flex flex-col gap-2 pointer-events-auto">
          <div className="relative w-full">
            <button
              type="button"
              onClick={toggleLivesFilter}
              title={
                nearbyPanelPrefs.livesOnly
                  ? 'Désactiver le filtre Lives'
                  : 'Afficher les lives sur la carte'
              }
              aria-label={
                nearbyPanelPrefs.livesOnly
                  ? 'Désactiver le filtre Lives'
                  : 'Afficher les lives sur la carte'
              }
              aria-pressed={nearbyPanelPrefs.livesOnly}
              className={`${MAP_STACK_FILTER_BTN} ${
                nearbyPanelPrefs.livesOnly
                  ? 'bg-red-950/80 border-red-500 text-red-400'
                  : 'bg-[#12121a] border-[#2d2d3d] hover:border-red-500/50 text-white/60 hover:text-white/90'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {nearbyPanelPrefs.livesOnly && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${nearbyPanelPrefs.livesOnly ? 'bg-red-500' : 'bg-white/25'}`} />
              </span>
              Lives
            </button>
            {nearbyPanelPrefs.livesOnly && livesFilterBadgeCount > 0 && (
              <span
                className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-600/90 px-0.5 text-[8px] font-bold leading-none text-white"
                aria-hidden
              >
                {livesFilterBadgeCount}
              </span>
            )}
          </div>
          <div className="relative w-full">
            <button
              type="button"
              onClick={toggleSalonFilter}
              title={
                showSalonMarkers
                  ? 'Désactiver le filtre Salon'
                  : 'Afficher les salons sur la carte'
              }
              aria-label={
                showSalonMarkers
                  ? 'Désactiver le filtre Salon'
                  : 'Afficher les salons sur la carte'
              }
              aria-pressed={showSalonMarkers}
              className={`${MAP_STACK_FILTER_BTN} ${
                showSalonMarkers
                  ? 'bg-fuchsia-950/80 border-fuchsia-500 text-fuchsia-200'
                  : 'bg-[#12121a] border-[#2d2d3d] hover:border-fuchsia-500/60 text-white/70 hover:text-fuchsia-200'
              }`}
            >
              <span aria-hidden className="shrink-0 flex h-2.5 w-2.5 items-center justify-center text-[10px] leading-none">
                🎵
              </span>
              Salon
            </button>
            {showSalonMarkers && salonFilterBadgeCount > 0 && (
              <span
                className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-fuchsia-600/90 px-0.5 text-[8px] font-bold leading-none text-white"
                aria-hidden
              >
                {salonFilterBadgeCount}
              </span>
            )}
          </div>
          {token && (
            <div className="relative w-full">
              <button
                type="button"
                onClick={onEventFilterClick}
                onPointerDown={onEventFilterPointerDown}
                onPointerUp={onEventFilterPointerUp}
                onPointerLeave={onEventFilterPointerUp}
                onPointerCancel={onEventFilterPointerUp}
                disabled={loadingMapEvents}
                title={
                  showEventMarkers
                    ? t('map.eventFilterDisableTitle')
                    : t('map.eventFilterEnableTitle')
                }
                aria-label={
                  showEventMarkers
                    ? t('map.eventFilterDisableTitle')
                    : t('map.eventFilterEnableTitle')
                }
                aria-pressed={showEventMarkers}
                className={`${MAP_STACK_FILTER_BTN} disabled:opacity-60 ${
                  showEventMarkers
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                    : 'bg-[#12121a] border-[#2d2d3d] hover:border-purple-500/60 text-white/70 hover:text-purple-200'
                }`}
              >
                {loadingMapEvents ? (
                  <span className="h-2.5 w-2.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                ) : (
                  <span aria-hidden className="shrink-0 flex h-2.5 w-2.5 items-center justify-center text-[10px] leading-none">
                    📅
                  </span>
                )}
                Évènement
              </button>
              {showEventMarkers && eventsFilterBadgeCount > 0 && (
                <span
                  className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-purple-600/90 px-0.5 text-[8px] font-bold leading-none text-white"
                  aria-hidden
                >
                  {eventsFilterBadgeCount}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={toggleMapStyle}
            title={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
            aria-label={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
            className={`self-center w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#12121a] border shadow-lg active:scale-95 transition shrink-0 text-lg ${mapStyle === 'globe' ? 'border-indigo-500 text-indigo-300' : 'border-[#2d2d3d] hover:border-indigo-500/60 text-white/70 hover:text-white'}`}
          >
            {mapStyle === 'globe' ? '🗺️' : '🌐'}
          </button>
        </div>

        {selected && (
          <MapSalonListenSheet
            salon={selected}
            expanded={salonSheetExpanded}
            sheetRef={salonSheetRef}
            onExpand={() => {
              pauseAllReelsMediaInDom();
              releaseAppMediaFocus('reels');
              requestAppMediaFocus('salon');
              setSalonSheetExpanded(true);
            }}
            onOpenHostProfile={openHostProfileFromSheet}
            onCollapse={() => setSalonSheetExpanded(false)}
            onClose={closeSalonSheet}
            onOpenFullExperience={() => {
              if (selected.isLive) {
                onOpenLive(selected.id);
                return;
              }
              openSalonFullFromSheet(selected.id);
            }}
            onMapInlineListenCapReached={handleMapInlineListenCapReached}
            onPlaybackStateChange={(state) =>
              setSelected((prev) => (prev ? { ...prev, playbackState: state } : prev))
            }
            onSalonUpdate={(updated) =>
              setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
            }
            mapPlaybackActive={mapPlaybackActive}
          />
        )}

        {selectedLive && (
          <MapLiveListenSheet
            live={selectedLive}
            sheetRef={liveSheetRef}
            onClose={closeLiveSheet}
            onOpenFullExperience={() => onOpenLive(selectedLive.id)}
            onOpenHostProfile={openHostProfileFromLiveSheet}
          />
        )}
        </div>

        {appa2 &&
          (showNearbyPeople ? (
            showEventMarkers && selectedEventCluster && !livesFilterOn ? (
              <MapCityEventsPanel
                layout={nearbyLayout}
                cluster={selectedEventClusterForPanel ?? selectedEventCluster}
                detailTier={mapDetailState.tier}
                favoriteIds={favoriteIds}
                onEventClick={handleCityEventClick}
                onBack={clearEventClusterSelection}
                onHide={() => setNearbyPeopleVisible(false)}
              />
            ) : (
              <NearbyPeoplePanel
                layout={nearbyLayout}
                content={mapSidebarContent}
                detail={mapDetailState}
                loading={loadingNearby}
                eventsLoading={showEventMarkers && loadingMapEvents}
                selectedSalonId={selected?.id}
                onPersonClick={openNearbyPerson}
                onSalonClick={handleMapSalonClick}
                onLiveClick={openLiveOnMap}
                onHide={() => setNearbyPeopleVisible(false)}
                onEventClick={handleCityEventClick}
                onEventClusterClick={handleMapEventClusterClick}
                eventsFilterOn={eventsFilterOn}
                livesFilterOn={livesFilterOn}
                salonFilterOn={salonFilterOn}
              />
            )
          ) : (
            <button
              type="button"
              onClick={() => setNearbyPeopleVisible(true)}
              title="Afficher la liste carte"
              aria-label="Afficher la liste carte"
              className="shrink-0 z-20 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--ms-surface)]/95 border-t border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wide">Liste carte</span>
              {anyMapFilterActive && mapSidebarItemCount > 0 && (
                <span className="text-[10px] font-bold bg-purple-600/80 text-white px-2 py-0.5 rounded-full min-w-[1.25rem]">
                  {mapSidebarItemCount}
                </span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}
