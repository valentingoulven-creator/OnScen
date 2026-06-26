import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { MapView, type MapViewHandle, type MapStyle } from '../components/MapView';
import { NearbyPeoplePanel } from '../components/NearbyPeoplePanel';
import { MapCityEventsPanel } from '../components/MapCityEventsPanel';
import { MapLiveClusterSheet } from '../components/MapLiveClusterSheet';
import { MapEventDetailModal } from '../components/MapEventDetailModal';
import { MapEventFilterSheet } from '../components/MapEventFilterSheet';
import {
  MapSalonFilterSheet,
  getDefaultSalonFilterCriteria,
  hasSalonFilterCityLocation,
  type MapSalonFilterCriteria,
} from '../components/MapSalonFilterSheet';
import { MapSalonListenSheet } from '../components/MapSalonListenSheet';
import { CreateSalonModal } from '../components/CreateSalonModal';
import { StartLiveFlowModals } from '../components/StartLiveFlowModals';
import { useStartLiveFlow } from '../hooks/useStartLiveFlow';
import { useHomeGeoRefresh } from '../hooks/useHomeGeoRefresh';
import { canJoinSalonAsParticipant, salonParticipantAccessMessageKey } from '../lib/platformConnect';
import { MapAdBanner, type MapSponsorViewport } from '../components/MapAdBanner';
import { MapActiveSessionOverlay } from '../components/MapActiveSessionOverlay';
import { LivesBrowseGrid } from '../components/LivesBrowseGrid';
import { MAP_EVENTS_REFRESH_EVENT, MAP_OPEN_CREATE_SALON_EVENT } from '../lib/mapUiEvents';
import { isAppa2Layout, type AppLayoutId } from '../lib/appLayout';
import { useCompactMapViewport } from '../hooks/usePhoneWebViewport';
import {
  createDefaultEventFilter,
  filterMapEventsByCriteria,
  getEventFilterCityMapRadiusKm,
  getTodayDateInputValue,
  hasEventFilterCityLocation,
  resolveDefaultUserCityLabel,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  type MapEventFilterCriteria,
} from '../lib/mapEventFilter';
import { applySavedEventFavoriteState, feedPostFromMapEventMarker, loadMapEventMarkers } from '../lib/mapFeedEvents';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { clusterMapEventsByCity, getCityMapView } from '../lib/mapEventClusters';
import type { MapLiveLocationCluster } from '../lib/mapLiveClusters';
import {
  buildMapSidebarContent,
  countLivesFilterBadge,
  countMapSidebarItems,
  countEventsSidebarItems,
  countSalonsSidebarItems,
} from '../lib/mapSidebarContent';
import {
  clipLivesForMapView,
  clipPeopleForMapView,
  clipSalonsForMapView,
  filterEventClustersInViewport,
  filterMarkersInViewport,
  getDistanceKm,
  getFlatMapDetailTier,
  getMapBoundsCenter,
  GLOBE_ALTITUDE_CITY_MAX,
  isPublicSalon,
  mapSidebarDetailEqual,
  shouldClipMapMarkersToViewport,
  shouldShowAllSalonsAtCityZoom,
  type MapViewDetailState,
} from '../lib/mapMarkerVisibility';
import type { NearbyPerson, Salon, Live, MapEventMarker, MapEventCityCluster, PlaybackState, FeedPost } from '../types';
import { getNearbyRadiusKm, SETTINGS_CHANGED_EVENT } from '../lib/settings';
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
  getMapSidebarListVisible,
  getNearbyPanelPreferences,
  resolveNearbyDistanceFilterForMap,
  NEARBY_PANEL_CHANGED_EVENT,
  setMapSidebarListVisible,
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
import { mergeRemotePlaybackState, resolveSalonYoutubeTrackId } from '../lib/salonPlayback';
import {
  nearbyCacheKey,
  clearNearbyCache,
  readNearbyCache,
  writeNearbyCache,
} from '../lib/nearbyCache';
import {
  canUseGlobeView,
  disableGlobeView,
  GLOBE_UNAVAILABLE_EVENT,
  MAP_STYLE_STORAGE_KEY,
  shouldForceFlatMap,
} from '../lib/webglSupport';

/** Debounce viewport-driven nearby reloads (filtre Lives, pan/zoom). */
const LIVES_VIEWPORT_NEARBY_DEBOUNCE_MS = 400;
/** Bounds-only sidebar updates while panning the flat map. */
const MAP_DETAIL_BOUNDS_DEBOUNCE_MS = 250;

const MAP_STYLE_KEY = MAP_STYLE_STORAGE_KEY;
const MAP_LIVE_ZOOM = 15;
/** Recentrer : quartier (GPS) vs ville (profil). */
const MAP_RECENTER_ZOOM_GPS = 13;
const MAP_RECENTER_ZOOM_CITY = 12;
/** Boutons Lives / Évènement (pile haut-gauche carte) — padding, typo et hauteur alignés. */
const MAP_STACK_FILTER_BTN =
  'w-full min-h-[2rem] px-3 py-2 rounded-full border shadow-lg active:scale-95 transition shrink-0 text-[10px] sm:text-[11px] font-bold leading-none whitespace-nowrap flex items-center justify-center gap-1.5';

/** Boutons icône (grille lives / globe) — même hauteur que MAP_STACK_FILTER_BTN. */
const MAP_STACK_ICON_BTN =
  'w-8 h-8 min-h-[2rem] shrink-0 flex items-center justify-center rounded-full border shadow-lg active:scale-95 transition select-none';

/** FAB carte : créer salon / live (bas-gauche). */
const MAP_CREATE_FAB_BTN =
  'px-5 py-2.5 sm:py-3 rounded-full bg-[#12121a] border border-[#2d2d3d] hover:border-purple-500/60 font-extrabold text-sm sm:text-base shadow-lg shadow-black/30 whitespace-nowrap active:scale-95 transition shrink-0 min-w-[5.5rem] sm:min-w-[6.5rem]';

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
  onOpenSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  /** Ouvre le salon minimisé + PiP vidéo (clic live sidebar carte). */
  onOpenSalonPip?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  /** Aperçu PiP sans rejoindre — clic sidebar carte. Remplace onOpenSalonPip pour le flux prévisualisation. */
  onOpenSalonPipPreview?: (salon: Salon) => void;
  /** Aperçu live PiP sans rejoindre (HLS/WebRTC) — persiste toutes les pages via App root. */
  onOpenLivePipPreview?: (live: Live) => void;
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
  /** Onglet Carte actif (pas d'overlay profil) : requêtes nearby / intervalles. */
  isActive?: boolean;
  /** Réouvre la fiche salon carte après réduction du grand salon. */
  restoreSalonId?: string | null;
  onSalonMapRestored?: () => void;
  /** Session salon App (source de vérité) — sync fiche carte sans leave_salon au démontage. */
  activeSalonSessionId?: string | null;
  /** Salon sélectionné sur la fiche carte (petit salon actif). */
  onMapSalonActive?: (session: { id: string; title?: string; isHost?: boolean } | null) => void;
  /** Quitter volontairement le salon (session + navigation). */
  onLeaveSalon?: () => void;
  /** Salon introuvable côté API (supprimé / expiré) pendant restore carte. */
  onSalonRestoreFailed?: (salonId: string) => void;
  /** Recherche globale → carte (ville / pays). */
  mapSearchIntent?: import('../lib/mapSearchIntent').MapSearchSearchIntent | null;
  onMapSearchIntentConsumed?: () => void;
  /** Session salon / live active — chip haut-droit carte (masque bandeau header). */
  mapActiveSalonSession?: { id: string; title?: string; isHost?: boolean } | null;
  mapActiveLiveSession?: { id: string; isHost?: boolean } | null;
  onMapReturnToSalon?: () => void;
  onMapReturnToLive?: () => void;
}

export function HomePage({
  appLayout = 'default',
  onOpenSalon,
  onOpenSalonPip,
  onOpenSalonPipPreview,
  onOpenLivePipPreview,
  onOpenLive,
  onOpenLiveTab,
  onOpenProfile,
  onOpenFeedPost,
  mapProfileOpen = false,
  onCloseMapProfile,
  mapPlaybackActive = true,
  isActive = true,
  restoreSalonId,
  onSalonMapRestored,
  activeSalonSessionId = null,
  onMapSalonActive,
  onLeaveSalon,
  onSalonRestoreFailed,
  mapSearchIntent = null,
  onMapSearchIntentConsumed,
  mapActiveSalonSession = null,
  mapActiveLiveSession = null,
  onMapReturnToSalon,
  onMapReturnToLive,
}: HomePageProps) {
  const { t } = useTranslation();
  const appa2 = isAppa2Layout(appLayout);
  const compactMapLayout = useCompactMapViewport();
  const bottomMapList = appa2 || compactMapLayout;
  const nearbyLayout = bottomMapList ? ('bottom' as const) : ('side' as const);
  const { user, token, setUserFromProfile } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<NearbyPerson[]>([]);
  const [selected, setSelected] = useState<Salon | null>(null);
  const [center, setCenter] = useState<[number, number]>(() => [...DEFAULT_CENTER]);
  const mapRecenterTokenRef = useRef(0);
  const [mapRecenterToken, setMapRecenterToken] = useState(0);
  /** Après pan carte ou rotation globe — ne pas ramener le viewport sur le GPS tardif. */
  const mapExploredRef = useRef(false);
  const setSafeCenter = useCallback((coords: [number, number]) => {
    if (!isValidLatLng(coords[0], coords[1])) {
      mapRecenterTokenRef.current += 1;
      setMapRecenterToken(mapRecenterTokenRef.current);
      setCenter([...DEFAULT_CENTER]);
      return;
    }
    mapRecenterTokenRef.current += 1;
    setMapRecenterToken(mapRecenterTokenRef.current);
    setCenter(sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER));
  }, []);
  const setMapViewportCenter = useCallback((coords: [number, number]) => {
    if (!isValidLatLng(coords[0], coords[1])) return;
    mapExploredRef.current = true;
    setCenter(sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER));
  }, []);
  const noteMapExplored = useCallback(() => {
    mapExploredRef.current = true;
  }, []);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  /** Vue grille lives à la place de la carte (toggle logo). */
  const [mapLivesBrowseOpen, setMapLivesBrowseOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [showNearbyPeople, setShowNearbyPeople] = useState(getMapSidebarListVisible);
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    const saved = localStorage.getItem(MAP_STYLE_KEY) as MapStyle | null;
    if (shouldForceFlatMap() || (saved === 'globe' && !canUseGlobeView())) {
      return 'flat';
    }
    return saved ?? 'flat';
  });
  const [nearbyPanelPrefs, setNearbyPanelPrefs] = useState(getNearbyPanelPreferences);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => new Set());
  const [savedEventPostIds, setSavedEventPostIds] = useState<Set<string>>(() => new Set());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const salonSheetRef = useRef<HTMLDivElement>(null);
  const mapViewRef = useRef<MapViewHandle>(null);
  const eventFilterFlyPendingRef = useRef<MapEventFilterCriteria | null>(null);
  const lastEventFilterCityFlyRef = useRef<string | null>(null);
  const lastSalonFilterCityFlyRef = useRef<string | null>(null);
  const mapEventsRef = useRef<MapEventMarker[]>([]);
  const mapEventPostsRef = useRef<Map<string, FeedPost>>(new Map());
  const [salonSheetExpanded, setSalonSheetExpanded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showEventMarkers, setShowEventMarkers] = useState(false);
  const [eventFilterCriteria, setEventFilterCriteria] =
    useState<MapEventFilterCriteria>(createDefaultEventFilter);
  const [showEventFilterSheet, setShowEventFilterSheet] = useState(false);
  const [showSalonFilterSheet, setShowSalonFilterSheet] = useState(false);
  const [salonFilterCriteria, setSalonFilterCriteria] = useState<MapSalonFilterCriteria>(() =>
    getDefaultSalonFilterCriteria(getLivesGeo())
  );
  useEffect(() => {
    if (!showEventFilterSheet) lastEventFilterCityFlyRef.current = null;
  }, [showEventFilterSheet]);
  useEffect(() => {
    if (!showSalonFilterSheet) lastSalonFilterCityFlyRef.current = null;
  }, [showSalonFilterSheet]);
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

  useEffect(() => {
    const onGlobeDisabled = () => {
      setMapStyle('flat');
      setToastMsg(t('map.globeFallback'));
    };
    window.addEventListener(GLOBE_UNAVAILABLE_EVENT, onGlobeDisabled);
    return () => window.removeEventListener(GLOBE_UNAVAILABLE_EVENT, onGlobeDisabled);
  }, [t]);
  /** Filtre carte « salons » — combinable avec Lives et Évènement. */
  const [showSalonMarkers, setShowSalonMarkers] = useState(false);
  const showSalonMarkersRef = useRef(showSalonMarkers);
  useEffect(() => {
    showSalonMarkersRef.current = showSalonMarkers;
  }, [showSalonMarkers]);
  const [mapEvents, setMapEvents] = useState<MapEventMarker[]>([]);
  useEffect(() => {
    mapEventsRef.current = mapEvents;
  }, [mapEvents]);
  const [mapEventsRefreshKey, setMapEventsRefreshKey] = useState(0);
  const eventFilterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventFilterLongPressTriggeredRef = useRef(false);
  const salonFilterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salonFilterLongPressTriggeredRef = useRef(false);
  const [loadingMapEvents, setLoadingMapEvents] = useState(false);
  const [selectedEventCluster, setSelectedEventCluster] = useState<MapEventCityCluster | null>(null);
  const [selectedLiveCluster, setSelectedLiveCluster] = useState<MapLiveLocationCluster | null>(null);
  const [selectedMapEvent, setSelectedMapEvent] = useState<MapEventMarker | null>(null);
  const [mapEventPostVersion, setMapEventPostVersion] = useState(0);
  /** Centre de la dernière requête api.nearby (pour clip viewport stable). */
  const [nearbyFetchCenter, setNearbyFetchCenter] = useState<[number, number]>(() => [
    ...DEFAULT_CENTER,
  ]);
  const nearbyFetchCenterRef = useRef<[number, number]>([...DEFAULT_CENTER]);
  const livesFilterWasOnRef = useRef(false);
  const salonFilterWasOnRef = useRef(false);
  const pendingMapFilterNearbyReloadRef = useRef(false);
  const lastGlobeNearbyRef = useRef<{ lat: number; lon: number } | null>(null);
  const mapFilterViewportNearbyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!isActive || !token) {
      if (!token) {
        setFavoriteIds(new Set());
        setFollowingIds(new Set());
        setSavedEventPostIds(new Set());
      }
      return;
    }
    api
      .getMyFavorites(token)
      .then((r) => setFavoriteIds(new Set(r.favorites.map((f) => f.id))))
      .catch(() => setFavoriteIds(new Set()));
    api
      .getMyFollowing(token)
      .then((r) => setFollowingIds(new Set(r.followingIds)))
      .catch(() => setFollowingIds(new Set()));
    api
      .getFavoritedFeedPosts(token)
      .then((r) =>
        setSavedEventPostIds(
          new Set(r.posts.filter((p) => p.isEvent).map((p) => p.id))
        )
      )
      .catch(() => setSavedEventPostIds(new Set()));
  }, [isActive, token]);

  useEffect(() => {
    if (!savedEventPostIds.size) return;
    let changed = false;
    for (const id of savedEventPostIds) {
      const cached = mapEventPostsRef.current.get(id);
      if (cached && !cached.favoriteByMe) {
        mapEventPostsRef.current.set(id, { ...cached, favoriteByMe: true });
        changed = true;
      }
    }
    if (changed) setMapEventPostVersion((v) => v + 1);
  }, [savedEventPostIds]);

  const selectedMapEventPost = useMemo(() => {
    if (!selectedMapEvent) return null;
    void mapEventPostVersion;
    const cached = mapEventPostsRef.current.get(selectedMapEvent.id);
    if (!cached) return null;
    return applySavedEventFavoriteState(cached, savedEventPostIds);
  }, [selectedMapEvent, savedEventPostIds, mapEventPostVersion]);

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

  useEffect(() => {
    if (selected) {
      onMapSalonActive?.({
        id: selected.id,
        title: selected.title,
        isHost: selected.hostId === user?.id,
      });
    } else {
      onMapSalonActive?.(null);
    }
  }, [selected?.id, selected?.title, selected?.hostId, user?.id, onMapSalonActive]);

  const prevActiveSalonSessionIdRef = useRef<string | null>(activeSalonSessionId);
  useEffect(() => {
    const prev = prevActiveSalonSessionIdRef.current;
    prevActiveSalonSessionIdRef.current = activeSalonSessionId;
    if (prev && !activeSalonSessionId && selected?.id === prev) {
      setSelected((current) => {
        if (current?.id === prev) {
          clearMapInlineListenSession(prev);
          return null;
        }
        return current;
      });
      setSalonSheetExpanded(false);
    }
  }, [activeSalonSessionId, selected?.id]);

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
  /** Rechargement nearby au centre viewport (carte / globe). */
  const mapFilterViewportOn = livesFilterOn || salonFilterOn;

  const mapEventAuthorIds = useMemo(() => {
    if (!eventsFilterOn) return undefined;
    const ids = new Set<string>();
    for (const event of mapEvents) {
      if (event.authorId) ids.add(event.authorId);
    }
    return ids;
  }, [mapEvents, eventsFilterOn]);

  const mapPeople = useMemo(
    () => peopleMarkersOnMap(filteredNearbyPeople, mapEventAuthorIds),
    [filteredNearbyPeople, mapEventAuthorIds]
  );

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

  // Extract individual mapDetailState fields used as useMemo dependencies.
  //
  // Using the full `mapDetailState` object as a dep would invalidate every memo
  // that touches viewport clipping whenever ANY field changes (including flatZoom
  // or globeAltitude), even when bounds/style/tier haven't changed.  Listing
  // individual fields lets each memo stay stable when only irrelevant fields update.
  const mapDetailBounds   = mapDetailState.bounds;
  const mapDetailMapStyle = mapDetailState.mapStyle;
  const mapDetailTier     = mapDetailState.tier;
  const mapDetailFlatZoom = mapDetailState.flatZoom;

  /** Vue globe overview : sonars live visibles sans activer le filtre Lives. */
  const globeLiveAmbientOn =
    mapDetailMapStyle === 'globe' && mapDetailTier === 'overview';

  const mapSalonsForView = useMemo(() => {
    if (!anyMapFilterActive && !globeLiveAmbientOn) return [];

    const merged = new Map<string, Salon>();
    const addSalons = (list: Salon[]) => {
      for (const salon of list) {
        if (!isValidLatLng(salon.latitude, salon.longitude)) continue;
        merged.set(salon.id, salon);
      }
    };

    if (salonFilterOn) {
      const publicSalons = salons.filter(isPublicSalon);
      if (mapDetailTier === 'overview') {
        addSalons(publicSalons);
      } else {
        addSalons(
          clipSalonsForMapView(
            publicSalons,
            { bounds: mapDetailBounds, mapStyle: mapDetailMapStyle },
            nearbyFetchCenter
          )
        );
      }
    } else if (livesFilterOn || globeLiveAmbientOn) {
      const source = livesFilterOn ? mapSalons : mapSalons.filter((s) => s.isLive);
      addSalons(
        mapDetailTier === 'overview' && (livesFilterOn || globeLiveAmbientOn)
          ? source
          : clipSalonsForMapView(
              source,
              { bounds: mapDetailBounds, mapStyle: mapDetailMapStyle },
              nearbyFetchCenter
            )
      );
    }

    return sortSalonsForNearby([...merged.values()], nearbyPanelPrefs.sortBy, nearbySortOptions);
  }, [
    anyMapFilterActive,
    globeLiveAmbientOn,
    salonFilterOn,
    livesFilterOn,
    salons,
    mapSalons,
    mapDetailBounds,
    mapDetailMapStyle,
    mapDetailTier,
    nearbyFetchCenter,
    nearbyPanelPrefs.sortBy,
    nearbySortOptions,
  ]);

  const mapLivesForView = useMemo(() => {
    if (!anyMapFilterActive && !globeLiveAmbientOn) return [];
    if (!livesFilterOn && !globeLiveAmbientOn) return [];
    if (globeLiveAmbientOn && mapDetailTier === 'overview' && !livesFilterOn) {
      return mapLives;
    }
    return clipLivesForMapView(
      mapLives,
      { bounds: mapDetailBounds, mapStyle: mapDetailMapStyle },
      nearbyFetchCenter
    );
  }, [
    anyMapFilterActive,
    globeLiveAmbientOn,
    livesFilterOn,
    mapLives,
    mapDetailBounds,
    mapDetailMapStyle,
    mapDetailTier,
    nearbyFetchCenter,
  ]);

  const mapPeopleForView = useMemo(() => {
    if (!anyMapFilterActive) return [];
    if (!livesFilterOn) return [];
    return clipPeopleForMapView(
      mapPeople,
      { bounds: mapDetailBounds, mapStyle: mapDetailMapStyle },
      nearbyFetchCenter
    );
  }, [anyMapFilterActive, livesFilterOn, mapPeople, mapDetailBounds, mapDetailMapStyle, nearbyFetchCenter]);
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
    if (mapDetailTier === 'overview') return mapEventClusters;
    if (mapDetailMapStyle !== 'flat' || !mapDetailBounds) return mapEventClusters;
    return filterEventClustersInViewport(mapEventClusters, mapDetailBounds, mapDetailTier);
  }, [mapEventClusters, mapDetailMapStyle, mapDetailBounds, mapDetailTier]);

  /** Panneau ville : événements filtrés par viewport au zoom ville / rue. */
  const selectedEventClusterForPanel = useMemo(() => {
    if (!selectedEventCluster) return null;
    if (mapDetailMapStyle !== 'flat' || !mapDetailBounds || mapDetailTier === 'overview') {
      return selectedEventCluster;
    }
    const eventsInView = filterMarkersInViewport(selectedEventCluster.events, mapDetailBounds);
    return { ...selectedEventCluster, events: eventsInView, count: eventsInView.length };
  }, [selectedEventCluster, mapDetailMapStyle, mapDetailBounds, mapDetailTier]);

  // buildMapSidebarContent only reads detail.tier, detail.mapStyle and detail.bounds
  // (flatZoom / globeAltitude are not used inside that function).
  // All four field variables are extracted above the memos block.
  const mapSidebarContent = useMemo(
    () =>
      buildMapSidebarContent({
        // Pass only the fields the function actually reads; flatZoom and
        // globeAltitude are unused so placeholder values keep types happy.
        detail: { tier: mapDetailTier, mapStyle: mapDetailMapStyle, bounds: mapDetailBounds, flatZoom: 0, globeAltitude: null },
        eventsFilterOn,
        livesFilterOn,
        salonFilterOn,
        eventsOnly: mapEventsOnly,
        showAllSalonsAtCityZoom,
        mapEvents: filteredMapEvents,
        eventClusters: mapEventClusters,
        lives: mapLives,
        salons: salonFilterOn ? salons : mapSalonsForView,
        people: mapPeople,
        favoriteIds,
        followingIds,
        savedEventPostIds,
        nearbyFetchCenter,
      }),
    [
      mapDetailTier,
      mapDetailMapStyle,
      mapDetailBounds,
      eventsFilterOn,
      livesFilterOn,
      salonFilterOn,
      showAllSalonsAtCityZoom,
      mapEventsOnly,
      filteredMapEvents,
      mapEventClusters,
      mapLives,
      mapSalonsForView,
      mapPeople,
      favoriteIds,
      followingIds,
      savedEventPostIds,
      nearbyFetchCenter,
    ]
  );

  const mapSidebarItemCount = useMemo(
    () => countMapSidebarItems(mapSidebarContent),
    [mapSidebarContent]
  );

  /** Badge filtre Salon : salons uniques (suivi + zone + suggestions). */
  const salonFilterBadgeCount = salonFilterOn ? countSalonsSidebarItems(mapSidebarContent) : 0;

  /** Badge filtre Évènement : événements/clusters uniques dans la sidebar. */
  const eventsFilterBadgeCount = eventsFilterOn
    ? countEventsSidebarItems(mapSidebarContent)
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
          }, MAP_DETAIL_BOUNDS_DEBOUNCE_MS);
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

  const mapLiveStartGeo = useMemo(
    (): LivesGeoPrefs => ({
      ...mapGeo,
      latitude: nearbyQueryCenter[0],
      longitude: nearbyQueryCenter[1],
    }),
    [mapGeo, nearbyQueryCenter]
  );

  const liveStartFlow = useStartLiveFlow({
    onOpenLive,
    hasActiveSalon: activeSalonSessionId != null,
    isActive,
    initialGeo: mapLiveStartGeo,
  });
  const { startError: liveStartError, dismissStartError: dismissLiveStartError } = liveStartFlow;

  useEffect(() => {
    if (!liveStartError) return;
    setToastMsg(liveStartError);
    dismissLiveStartError();
  }, [liveStartError, dismissLiveStartError]);

  const setNearbyPeopleVisible = useCallback((visible: boolean) => {
    setShowNearbyPeople(visible);
    setMapSidebarListVisible(visible);
  }, []);

  const toggleMapStyle = useCallback(() => {
    const next: MapStyle = mapStyle === 'flat' ? 'globe' : 'flat';
    if (next === 'globe' && !canUseGlobeView()) {
      setToastMsg(t('map.globeUnavailable'));
      return;
    }
    setMapStyle(next);
    localStorage.setItem(MAP_STYLE_KEY, next);
  }, [mapStyle, t]);

  const handleGlobeUnavailable = useCallback(() => {
    disableGlobeView();
  }, []);

  const disableEventsFilter = useCallback(() => {
    setSelectedEventCluster(null);
    setShowEventMarkers(false);
    setShowEventFilterSheet(false);
  }, []);

  /** Un seul filtre carte actif à la fois : Lives, Salon ou Évènement. */
  const deactivateMapContentFiltersExcept = useCallback(
    (except: 'lives' | 'salon' | 'events' | null) => {
      if (except !== 'lives' && nearbyPanelPrefs.livesOnly) {
        setNearbyPanelPreferences({ livesOnly: false });
      }
      if (except !== 'salon' && showSalonMarkers) {
        pendingMapFilterNearbyReloadRef.current = true;
        clearNearbyCache();
        setShowSalonMarkers(false);
        setShowSalonFilterSheet(false);
      }
      if (except !== 'events' && showEventMarkers) {
        disableEventsFilter();
      }
    },
    [nearbyPanelPrefs.livesOnly, showSalonMarkers, showEventMarkers, disableEventsFilter]
  );

  /** Filtres carte haut-gauche : Lives, Salon et Évènement — un seul actif à la fois. */
  const toggleLivesFilter = useCallback(() => {
    if (nearbyPanelPrefs.livesOnly) {
      setNearbyPanelPreferences({ livesOnly: false });
      return;
    }
    deactivateMapContentFiltersExcept('lives');
    setNearbyPanelPreferences({ livesOnly: true });
  }, [nearbyPanelPrefs.livesOnly, deactivateMapContentFiltersExcept]);

  /** Logo carte → bascule carte / grille lives (sans changer d'onglet). */
  const toggleMapLivesBrowse = useCallback(() => {
    setMapLivesBrowseOpen((open) => {
      const next = !open;
      if (next && nearbyPanelPrefs.livesOnly) {
        setNearbyPanelPreferences({ livesOnly: false });
      }
      return next;
    });
  }, [nearbyPanelPrefs.livesOnly]);

  const disableSalonFilter = useCallback(() => {
    pendingMapFilterNearbyReloadRef.current = true;
    clearNearbyCache();
    setShowSalonMarkers(false);
    setShowSalonFilterSheet(false);
  }, []);

  const openSalonFilterSheet = useCallback(() => {
    if (!showSalonMarkers) {
      deactivateMapContentFiltersExcept(null);
    }
    setSalonFilterCriteria(getDefaultSalonFilterCriteria(mapGeo));
    setShowSalonFilterSheet(true);
  }, [showSalonMarkers, deactivateMapContentFiltersExcept, mapGeo]);

  const flyMapToSalonFilterCity = useCallback(
    (lat: number, lng: number, locationLabel: string, opts?: { force?: boolean }) => {
      if (!isValidLatLng(lat, lng)) return;
      const radiusKm = getEventFilterCityMapRadiusKm(locationLabel);
      const flyKey = `${locationLabel.trim().toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}|${radiusKm}`;
      if (!opts?.force && lastSalonFilterCityFlyRef.current === flyKey) return;
      lastSalonFilterCityFlyRef.current = flyKey;

      if (mapStyle === 'globe') {
        mapViewRef.current?.jumpToCityBounds(lat, lng, radiusKm);
        setMapStyle('flat');
        localStorage.setItem(MAP_STYLE_KEY, 'flat');
      } else {
        mapViewRef.current?.flyToCityBounds(lat, lng, radiusKm);
      }
    },
    [mapStyle]
  );

  const flyToSalonFilterBounds = useCallback(
    (criteria: MapSalonFilterCriteria, force = false) => {
      if (!hasSalonFilterCityLocation(criteria)) return;
      flyMapToSalonFilterCity(criteria.latitude!, criteria.longitude!, criteria.location, { force });
    },
    [flyMapToSalonFilterCity]
  );

  const previewSalonFilterCity = useCallback(
    (lat: number, lng: number, location: string) => {
      flyMapToSalonFilterCity(lat, lng, location);
    },
    [flyMapToSalonFilterCity]
  );

  const toggleSalonFilter = useCallback(() => {
    if (showSalonMarkers) {
      disableSalonFilter();
      return;
    }
    openSalonFilterSheet();
  }, [showSalonMarkers, disableSalonFilter, openSalonFilterSheet]);

  const applySalonFilter = useCallback(
    (criteria: MapSalonFilterCriteria) => {
      deactivateMapContentFiltersExcept('salon');
      setSalonFilterCriteria(criteria);
      setNearbyPanelPreferences({
        sortBy: criteria.sortBy,
        musicalAffinitiesOnly: criteria.musicalAffinitiesOnly,
      });
      setShowSalonFilterSheet(false);
      pendingMapFilterNearbyReloadRef.current = true;
      clearNearbyCache();
      setShowSalonMarkers(true);
      setNearbyPeopleVisible(true);

      if (hasSalonFilterCityLocation(criteria)) {
        requestAnimationFrame(() => flyToSalonFilterBounds(criteria, true));
      }
    },
    [deactivateMapContentFiltersExcept, flyToSalonFilterBounds]
  );

  const onSalonFilterPointerDown = useCallback(() => {
    salonFilterLongPressTriggeredRef.current = false;
    if (salonFilterLongPressRef.current) clearTimeout(salonFilterLongPressRef.current);
    salonFilterLongPressRef.current = setTimeout(() => {
      salonFilterLongPressTriggeredRef.current = true;
      openSalonFilterSheet();
    }, 600);
  }, [openSalonFilterSheet]);

  const onSalonFilterPointerUp = useCallback(() => {
    if (salonFilterLongPressRef.current) {
      clearTimeout(salonFilterLongPressRef.current);
      salonFilterLongPressRef.current = null;
    }
  }, []);

  const onSalonFilterClick = useCallback(() => {
    if (salonFilterLongPressTriggeredRef.current) {
      salonFilterLongPressTriggeredRef.current = false;
      return;
    }
    toggleSalonFilter();
  }, [toggleSalonFilter]);

  const openEventFilterSheet = useCallback(() => {
    if (!showEventMarkers) {
      deactivateMapContentFiltersExcept(null);
    }
    setShowEventFilterSheet(true);
  }, [showEventMarkers, deactivateMapContentFiltersExcept]);

  const flyMapToEventFilterCity = useCallback(
    (lat: number, lng: number, locationLabel: string, opts?: { force?: boolean }) => {
      if (!isValidLatLng(lat, lng)) return;
      const radiusKm = getEventFilterCityMapRadiusKm(locationLabel);
      const flyKey = `${locationLabel.trim().toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}|${radiusKm}`;
      if (!opts?.force && lastEventFilterCityFlyRef.current === flyKey) return;
      lastEventFilterCityFlyRef.current = flyKey;

      if (mapStyle === 'globe') {
        mapViewRef.current?.jumpToCityBounds(lat, lng, radiusKm);
        setMapStyle('flat');
        localStorage.setItem(MAP_STYLE_KEY, 'flat');
      } else {
        mapViewRef.current?.flyToCityBounds(lat, lng, radiusKm);
      }
      // Ne pas setCenter ici : MapView réagit au prop center par un flyTo(zoom 13)
      // qui entre en conflit avec flyToCityBounds (double animation dézoom/rezoom).
    },
    [mapStyle]
  );

  const flyToEventFilterBounds = useCallback(
    (criteria: MapEventFilterCriteria, force = false) => {
      if (!hasEventFilterCityLocation(criteria)) return;
      flyMapToEventFilterCity(criteria.latitude!, criteria.longitude!, criteria.location, { force });
    },
    [flyMapToEventFilterCity]
  );

  const previewEventFilterCity = useCallback(
    (lat: number, lng: number, location: string) => {
      flyMapToEventFilterCity(lat, lng, location);
    },
    [flyMapToEventFilterCity]
  );

  const flyToEventMarkersBounds = useCallback((markers: MapEventMarker[]) => {
    const valid = markers.filter((m) => isValidLatLng(m.latitude, m.longitude));
    if (valid.length === 0) return;

    if (valid.length === 1) {
      mapViewRef.current?.flyToCityBounds(valid[0].latitude, valid[0].longitude, 5);
      return;
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const m of valid) {
      if (m.latitude < minLat) minLat = m.latitude;
      if (m.latitude > maxLat) maxLat = m.latitude;
      if (m.longitude < minLng) minLng = m.longitude;
      if (m.longitude > maxLng) maxLng = m.longitude;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    let maxDistKm = 0;
    for (const m of valid) {
      const d = getDistanceKm(centerLat, centerLng, m.latitude, m.longitude);
      if (d > maxDistKm) maxDistKm = d;
    }
    mapViewRef.current?.flyToCityBounds(centerLat, centerLng, Math.max(maxDistKm * 1.4, 10));
  }, []);

  const applyEventFilter = useCallback(
    (criteria: MapEventFilterCriteria) => {
      deactivateMapContentFiltersExcept('events');
      setEventFilterCriteria(criteria);
      setShowEventMarkers(true);
      setShowEventFilterSheet(false);

      if (hasEventFilterCityLocation(criteria)) {
        eventFilterFlyPendingRef.current = null;
        // Toujours cadrer à l'Appliquer (l'utilisateur peut avoir déplacé la carte pendant le sheet).
        requestAnimationFrame(() => flyToEventFilterBounds(criteria, true));
        return;
      }

      const markers = mapEventsRef.current;
      if (markers.length > 0) {
        eventFilterFlyPendingRef.current = null;
        const filtered = filterMapEventsByCriteria(markers, criteria, { viewerId: user?.id });
        flyToEventMarkersBounds(filtered.length > 0 ? filtered : markers);
        return;
      }

      eventFilterFlyPendingRef.current = criteria;
    },
    [flyToEventFilterBounds, flyToEventMarkersBounds, user?.id, deactivateMapContentFiltersExcept]
  );

  useEffect(() => {
    if (!mapSearchIntent || !isActive) return;
    deactivateMapContentFiltersExcept('events');
    const criteria = {
      ...createDefaultEventFilter(user?.city),
      dateFrom: getTodayDateInputValue(),
      location: mapSearchIntent.location,
      latitude: mapSearchIntent.latitude,
      longitude: mapSearchIntent.longitude,
      radiusKm: DEFAULT_EVENT_FILTER_RADIUS_KM,
      eventType: 'all' as const,
    };
    setEventFilterCriteria(criteria);
    setShowEventMarkers(true);
    requestAnimationFrame(() => flyToEventFilterBounds(criteria, true));
    onMapSearchIntentConsumed?.();
  }, [
    mapSearchIntent,
    isActive,
    user?.city,
    flyToEventFilterBounds,
    onMapSearchIntentConsumed,
    deactivateMapContentFiltersExcept,
  ]);

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
    if (!isActive || !token) return;

    let cancelled = false;
    const hadMarkers = mapEventsRef.current.length > 0;
    if (showEventMarkers && !hadMarkers) setLoadingMapEvents(true);

    loadMapEventMarkers(token, {
      signal: { cancelled },
      onProgress: (partial) => {
        if (cancelled || partial.length === 0) return;
        setMapEvents(partial);
        if (showEventMarkers) setLoadingMapEvents(false);
      },
    })
      .then(({ markers, postsById }) => {
        if (!cancelled) {
          mapEventPostsRef.current = postsById;
          setMapEvents(markers);
          const pendingFly = eventFilterFlyPendingRef.current;
          if (pendingFly && !hasEventFilterCityLocation(pendingFly) && markers.length > 0) {
            eventFilterFlyPendingRef.current = null;
            const filtered = filterMapEventsByCriteria(markers, pendingFly, { viewerId: user?.id });
            flyToEventMarkersBounds(filtered.length > 0 ? filtered : markers);
          }
        }
      })
      .catch(() => {
        if (!cancelled && showEventMarkers) {
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
  }, [isActive, token, mapEventsRefreshKey, showEventMarkers, user?.id, flyToEventMarkersBounds]);

  const handlePrepareFlatMap = useCallback(
    (lat: number, lng: number, zoom?: number, radiusKm?: number) => {
      mapViewRef.current?.prepareFlatAt(lat, lng, zoom ?? 14, radiusKm);
    },
    []
  );

  const handleGlobeZoomToFlat = useCallback(
    (
      lat: number,
      lng: number,
      doSelect: () => void,
      zoom?: number,
      radiusKm?: number,
      _animated?: boolean
    ) => {
      // Repositionne la carte (prepareFlatAt déjà appelé pendant l'anim globe).
      if (radiusKm != null && radiusKm > 0) {
        mapViewRef.current?.jumpToCityBounds(lat, lng, radiusKm);
      } else {
        mapViewRef.current?.jumpTo(lat, lng, zoom ?? 14);
      }
      setMapStyle('flat');
      localStorage.setItem(MAP_STYLE_KEY, 'flat');
      setMapViewportCenter(sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER));
      setTimeout(doSelect, 340);
    },
    []
  );

  const handleAutoSwitchToGlobe = useCallback(() => {
    if (!canUseGlobeView()) return;
    setMapStyle('globe');
    localStorage.setItem(MAP_STYLE_KEY, 'globe');
  }, []);

  // Ref holding the debounce timer for settings-triggered reloads.
  const nearbyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce salon_playback socket events (fires ~every second) to limit re-renders.
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
    opts?: { updateUserGeo?: boolean; silent?: boolean }
  ) => {
    const [lat, lon] = coords;
    if (!token || !isValidLatLng(lat, lon)) return;
    const prefs = getNearbyPanelPreferences();
    const radius = getNearbyRadiusKm();
    const distanceFilter = resolveNearbyDistanceFilterForMap(
      prefs,
      showSalonMarkersRef.current
    );
    const cacheKey = nearbyCacheKey(lat, lon, radius, distanceFilter);
    const cached = readNearbyCache(cacheKey);
    if (cached) {
      applyNearbyResponse([lat, lon], cached);
      return;
    }

    if (!opts?.silent) setLoadingNearby(true);
    const runNearby = () =>
      api
        .nearby(token, lat, lon, {
          radiusKm: radius,
          distanceFilter,
        })
        .then((r) => {
          writeNearbyCache(cacheKey, r);
          applyNearbyResponse([lat, lon], r);
        })
        .finally(() => {
          if (!opts?.silent) setLoadingNearby(false);
        });

    if (opts?.updateUserGeo === false) {
      runNearby();
      return;
    }
    api
      .updateGeo(token, lat, lon)
      .catch((err: unknown) => {
        console.warn('[HomePage] updateGeo failed (silent retry):', err);
      })
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

  useHomeGeoRefresh({
    isActive,
    token,
    center,
    defaultCenter: DEFAULT_CENTER,
    loadNearbyAt,
    loadNearbyFromState,
    setSafeCenter,
    setUserPosition,
    mapExploredRef,
    geoIntervalRef,
  });

  useEffect(() => {
    if (!isActive) return;
    const onMapGeo = () => {
      mapExploredRef.current = false;
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
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1]));
          setSafeCenter(coords);
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
  }, [isActive, token]);

  useEffect(() => {
    if (!isActive) return;
    const reloadFromPrefs = () => {
      loadNearbyFromStateDebounced(userPosition, center);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    };
  }, [isActive, token, userPosition, center, loadNearbyFromStateDebounced]);

  /** Ignore bounds-driven nearby reloads pendant flyTo programmé (center prop). */
  const programmaticMapMoveUntilRef = useRef(0);
  useEffect(() => {
    programmaticMapMoveUntilRef.current = Date.now() + 900;
  }, [center]);

  /** Rechargement nearby en attente (filtre Lives/Salon ON avant bounds / globe prêts). */
  const loadNearbyViewportDebounced = useCallback(
    (coords: [number, number]) => {
      if (mapFilterViewportNearbyDebounceRef.current) {
        clearTimeout(mapFilterViewportNearbyDebounceRef.current);
      }
      mapFilterViewportNearbyDebounceRef.current = setTimeout(() => {
        mapFilterViewportNearbyDebounceRef.current = null;
        loadNearbyAt(coords, { updateUserGeo: false, silent: true });
      }, LIVES_VIEWPORT_NEARBY_DEBOUNCE_MS);
    },
    [loadNearbyAt]
  );

  useEffect(() => {
    return () => {
      if (mapFilterViewportNearbyDebounceRef.current) {
        clearTimeout(mapFilterViewportNearbyDebounceRef.current);
      }
    };
  }, []);

  const resolveMapFilterNearbyQueryCenter = useCallback((): [number, number] | null => {
    if (mapDetailState.mapStyle === 'flat' && mapDetailState.bounds) {
      return getMapBoundsCenter(mapDetailState.bounds);
    }
    if (mapDetailState.mapStyle === 'globe') {
      return sanitizeLatLngTuple(center[0], center[1], DEFAULT_CENTER);
    }
    return null;
  }, [mapDetailState.mapStyle, mapDetailState.bounds, center]);

  useEffect(() => {
    if (mapFilterViewportOn) {
      pendingMapFilterNearbyReloadRef.current = true;
      return;
    }
    pendingMapFilterNearbyReloadRef.current = false;
    lastGlobeNearbyRef.current = null;
  }, [mapFilterViewportOn]);

  /** Filtre Lives/Salon ON : recharger nearby dès que le centre requête est connu (flat ou globe). */
  useEffect(() => {
    if (!isActive || !mapFilterViewportOn || !token || !pendingMapFilterNearbyReloadRef.current) return;
    const queryCenter = resolveMapFilterNearbyQueryCenter();
    if (!queryCenter) return;
    pendingMapFilterNearbyReloadRef.current = false;
    loadNearbyAt(queryCenter, { updateUserGeo: false });
    if (mapDetailState.mapStyle === 'globe') {
      lastGlobeNearbyRef.current = { lat: queryCenter[0], lon: queryCenter[1] };
    }
  }, [
    isActive,
    mapFilterViewportOn,
    mapDetailState,
    token,
    loadNearbyAt,
    resolveMapFilterNearbyQueryCenter,
  ]);

  /** Filtre Lives/Salon : recharger nearby au centre viewport (carte plate, sans updateGeo). */
  useEffect(() => {
    if (!isActive || !mapFilterViewportOn || !token) return;
    if (mapDetailState.mapStyle !== 'flat' || !mapDetailState.bounds) return;
    if (pendingMapFilterNearbyReloadRef.current) return;
    if (Date.now() < programmaticMapMoveUntilRef.current) return;

    const viewportCenter = getMapBoundsCenter(mapDetailState.bounds);
    const anchor = nearbyFetchCenterRef.current;
    const viewportStale = !shouldClipMapMarkersToViewport(mapDetailState, anchor);

    if (!viewportStale) {
      const radiusKm = getNearbyRadiusKm();
      const minDeltaKm = salonFilterOn
        ? 2
        : Math.max(5, radiusKm * 0.3);
      const movedKm = getDistanceKm(
        viewportCenter[0],
        viewportCenter[1],
        anchor[0],
        anchor[1]
      );
      if (movedKm < minDeltaKm) return;
    }

    loadNearbyViewportDebounced(viewportCenter);
  }, [isActive, mapFilterViewportOn, mapDetailState, token, salonFilterOn, loadNearbyViewportDebounced]);

  /** Filtre Lives/Salon + globe : recharger nearby quand l'utilisateur tourne/zoom le globe. */
  const handleGlobePovChange = useCallback(
    (lat: number, lng: number, altitude: number) => {
      if (!token) return;
      if (!isValidLatLng(lat, lng)) return;
      if (Date.now() < programmaticMapMoveUntilRef.current) return;

      mapExploredRef.current = true;
      setMapViewportCenter([lat, lng]);

      const atOverview = altitude >= GLOBE_ALTITUDE_CITY_MAX;
      const ambientGlobe = atOverview && !mapFilterViewportOn;

      if (!mapFilterViewportOn && !ambientGlobe) return;
      if (atOverview && !salonFilterOn && mapFilterViewportOn) return;

      const prev = lastGlobeNearbyRef.current;
      const radiusKm = getNearbyRadiusKm();
      const minDeltaKm = ambientGlobe
        ? 600
        : salonFilterOn
          ? 2
          : Math.max(5, radiusKm * 0.3);
      if (prev) {
        const movedKm = getDistanceKm(lat, lng, prev.lat, prev.lon);
        if (movedKm < minDeltaKm) return;
      }

      lastGlobeNearbyRef.current = { lat, lon: lng };
      loadNearbyViewportDebounced([lat, lng]);
    },
    [mapFilterViewportOn, salonFilterOn, token, loadNearbyViewportDebounced, setMapViewportCenter]
  );

  /** Désactivation filtre Lives : revenir aux données GPS / centre carte. */
  useEffect(() => {
    if (!isActive) return;
    if (livesFilterOn) {
      livesFilterWasOnRef.current = true;
      return;
    }
    if (!livesFilterWasOnRef.current || !token) return;
    livesFilterWasOnRef.current = false;
    if (!salonFilterOn) {
      loadNearbyFromState(userPosition, center);
    }
  }, [isActive, livesFilterOn, salonFilterOn, token, userPosition, center, loadNearbyFromState]);

  /** Désactivation filtre Salon : revenir aux données GPS / centre carte si Lives off. */
  useEffect(() => {
    if (!isActive) return;
    if (salonFilterOn) {
      salonFilterWasOnRef.current = true;
      return;
    }
    if (!salonFilterWasOnRef.current || !token) return;
    salonFilterWasOnRef.current = false;
    if (!livesFilterOn) {
      loadNearbyFromState(userPosition, center);
    }
  }, [isActive, salonFilterOn, livesFilterOn, token, userPosition, center, loadNearbyFromState]);

  const recenterLabel = isFixedMapGeoSource(mapGeo.source)
    ? `Recentrer sur ${mapGeo.label}`
    : 'Recentrer sur ma position';

  const mapSponsorViewport = useMemo((): MapSponsorViewport | null => {
    const sponsorZoomForTier = mapDetailTier === 'street' ? 12 : mapDetailTier === 'city' ? 9 : 6;

    if (mapDetailMapStyle === 'flat' && mapDetailBounds) {
      const [lat, lng] = getMapBoundsCenter(mapDetailBounds);
      const zoom =
        mapDetailTier === 'overview'
          ? Math.min(mapDetailFlatZoom, sponsorZoomForTier)
          : mapDetailFlatZoom;
      return {
        lat,
        lng,
        zoom,
        north: mapDetailBounds.north,
        south: mapDetailBounds.south,
        east: mapDetailBounds.east,
        west: mapDetailBounds.west,
      };
    }
    if (mapDetailMapStyle === 'globe') {
      return { lat: center[0], lng: center[1], zoom: sponsorZoomForTier };
    }
    return { lat: center[0], lng: center[1], zoom: sponsorZoomForTier };
  }, [mapDetailTier, mapDetailMapStyle, mapDetailBounds, mapDetailFlatZoom, center]);

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

  const handleCityEventClick = useCallback((event: MapEventMarker) => {
    setSelectedMapEvent(event);
  }, []);

  const clearEventClusterSelection = useCallback(() => {
    setSelectedEventCluster(null);
  }, []);

  const trySelectSalon = useCallback(async (
    salon: Salon,
    opts?: { closeMapProfile?: boolean; pipOnly?: boolean }
  ): Promise<boolean> => {
    if (salon.canJoin === false && salon.hostId !== user?.id) {
      setToastMsg('Salon sur invitation uniquement — le host doit vous autoriser');
      return false;
    }
    if (opts?.closeMapProfile) {
      onCloseMapProfile?.();
    }
    if (!opts?.pipOnly) {
      setSelected(salon);
      setSalonSheetExpanded(false);
    }
    const isHost = salon.hostId === user?.id;
    const platformLinked = canJoinSalonAsParticipant(
      salon.platform,
      user?.connectedPlatforms,
      isHost
    );
    if (token && salon.canJoin !== true && salon.hostId !== user?.id) {
      if (!platformLinked) {
        setToastMsg(t(salonParticipantAccessMessageKey(salon.platform)));
      } else {
        try {
          await api.joinSalon(token, salon.id);
        } catch (e) {
          setSelected(null);
          setToastMsg(e instanceof Error ? e.message : 'Accès refusé');
          return false;
        }
      }
    }
    return true;
  }, [user?.id, user?.connectedPlatforms, token, onCloseMapProfile, t]);

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

  const isOwnActiveHostedSalon = useCallback(
    (salon: Salon) =>
      Boolean(
        activeSalonSessionId &&
          salon.id === activeSalonSessionId &&
          (salon.isHost || salon.hostId === user?.id)
      ),
    [activeSalonSessionId, user?.id]
  );

  const restoreSalonOnMap = useCallback(async (salonId: string) => {
    const salon = await resolveSalonById(salonId);
    if (!salon) {
      onSalonRestoreFailed?.(salonId);
      return;
    }
    flyMapTo(salon.latitude, salon.longitude);
    if (isOwnActiveHostedSalon(salon)) return;
    await trySelectSalon(salon, { closeMapProfile: true });
  }, [
    resolveSalonById,
    flyMapTo,
    trySelectSalon,
    onSalonRestoreFailed,
    isOwnActiveHostedSalon,
  ]);

  useEffect(() => {
    if (!restoreSalonId) return;
    void restoreSalonOnMap(restoreSalonId).finally(() => onSalonMapRestored?.());
  }, [restoreSalonId, restoreSalonOnMap, onSalonMapRestored]);

  const resolveSalonForLive = useCallback(async (live: Live): Promise<Salon | undefined> => {
    let salon = findSalonForLive(live, salons);
    if (!salon && live.salonId) {
      salon = (await resolveSalonById(live.salonId)) ?? undefined;
    }
    if (!salon) {
      salon = (await resolveSalonById(live.id)) ?? undefined;
    }
    return salon;
  }, [salons, resolveSalonById]);

  /** Clic sidebar carte (live, salon, profil en direct) : PiP prévisualisation uniquement — sans rejoindre. */
  const openSalonPipFromMapSidebar = useCallback(
    (salon: Salon) => {
      onCloseMapProfile?.();
      setSelected(null);
      setSalonSheetExpanded(false);
      if (onOpenSalonPipPreview) {
        onOpenSalonPipPreview(salon);
      } else {
        onOpenSalonPip?.(salon.id, salon.title, salon.hostId === user?.id);
      }
    },
    [onCloseMapProfile, onOpenSalonPipPreview, onOpenSalonPip, user?.id]
  );

  const openLivePipFromMapSidebar = useCallback(
    (live: Live) => {
      onCloseMapProfile?.();
      setSelected(null);
      setSalonSheetExpanded(false);
      onOpenLivePipPreview?.(live);
    },
    [onCloseMapProfile, onOpenLivePipPreview]
  );

  /** Clic marqueur personne sur la carte : PiP uniquement (même chemin que la sidebar). */
  const handleMapPersonClick = useCallback((person: NearbyPerson) => {
    void (async () => {
      onCloseMapProfile?.();

      const salonId = await resolveSalonIdForPerson(person);
      if (salonId) {
        const salon = await resolveSalonById(salonId);
        if (salon) {
          flyMapTo(salon.latitude, salon.longitude);
          openSalonPipFromMapSidebar(salon);
          return;
        }
      }

      if (person.isLive && person.liveId) {
        const live = await resolveLiveForPerson(person);
        if (!live) return;
        flyMapTo(live.latitude, live.longitude);

        const salon = await resolveSalonForLive(live);
        if (salon && resolveSalonYoutubeTrackId(salon.playbackState)) {
          openSalonPipFromMapSidebar(salon);
          return;
        }

        openLivePipFromMapSidebar(live);
      }
    })();
  }, [
    resolveSalonIdForPerson,
    resolveSalonById,
    resolveLiveForPerson,
    resolveSalonForLive,
    openSalonPipFromMapSidebar,
    openLivePipFromMapSidebar,
    flyMapTo,
    onCloseMapProfile,
  ]);

  /** Clic salon sidebar : PiP vidéo uniquement, carte reste visible. */
  const handleSidebarSalonClick = useCallback((salon: Salon) => {
    flyMapTo(salon.latitude, salon.longitude);
    openSalonPipFromMapSidebar(salon);
  }, [flyMapTo, openSalonPipFromMapSidebar]);

  /** Clic live sidebar : PiP vidéo uniquement, carte reste visible. */
  const handleSidebarLiveClick = useCallback((l: Live) => {
    void (async () => {
      flyMapTo(l.latitude, l.longitude);

      const salon = await resolveSalonForLive(l);
      if (salon && resolveSalonYoutubeTrackId(salon.playbackState)) {
        openSalonPipFromMapSidebar(salon);
        return;
      }

      // True HLS/WebRTC live (no linked YouTube salon) → preview PiP, no socket join
      openLivePipFromMapSidebar(l);
    })();
  }, [
    resolveSalonForLive,
    openSalonPipFromMapSidebar,
    openLivePipFromMapSidebar,
    flyMapTo,
  ]);

  /** Clic personne sidebar (En direct) : salon/live → PiP, pas de bottom sheet. */
  const handleSidebarPersonClick = useCallback((person: NearbyPerson) => {
    void (async () => {
      onCloseMapProfile?.();

      const salonId = await resolveSalonIdForPerson(person);
      if (salonId) {
        const salon = await resolveSalonById(salonId);
        if (salon) {
          flyMapTo(salon.latitude, salon.longitude);
          openSalonPipFromMapSidebar(salon);
          return;
        }
      }

      if (person.isLive && person.liveId) {
        const live = await resolveLiveForPerson(person);
        if (!live) return;
        flyMapTo(live.latitude, live.longitude);

        const salon = await resolveSalonForLive(live);
        if (salon && resolveSalonYoutubeTrackId(salon.playbackState)) {
          openSalonPipFromMapSidebar(salon);
          return;
        }

        // True HLS/WebRTC live → preview PiP, no socket join
        openLivePipFromMapSidebar(live);
      }
    })();
  }, [
    resolveSalonIdForPerson,
    resolveSalonById,
    resolveLiveForPerson,
    resolveSalonForLive,
    openSalonPipFromMapSidebar,
    openLivePipFromMapSidebar,
    flyMapTo,
    onCloseMapProfile,
  ]);

  /** Clic marqueur live sur la carte : PiP uniquement, pas de bottom sheet. */
  const handleMapLiveClick = useCallback((l: Live) => {
    void (async () => {
      flyMapTo(l.latitude, l.longitude);

      const salon = await resolveSalonForLive(l);
      if (salon) {
        openSalonPipFromMapSidebar(salon);
        return;
      }

      openLivePipFromMapSidebar(l);
    })();
  }, [
    resolveSalonForLive,
    openSalonPipFromMapSidebar,
    openLivePipFromMapSidebar,
    flyMapTo,
  ]);

  const handleMapLiveClusterClick = useCallback((cluster: MapLiveLocationCluster) => {
    setSelectedLiveCluster(cluster);
    setSelectedEventCluster(null);
    flyMapTo(cluster.latitude, cluster.longitude);
  }, [flyMapTo]);

  const handleMapBackgroundClick = useCallback(() => {
    if (selectedEventCluster) setSelectedEventCluster(null);
    if (selectedLiveCluster) setSelectedLiveCluster(null);
    if (mapProfileOpen) onCloseMapProfile?.();
  }, [mapProfileOpen, onCloseMapProfile, selectedEventCluster, selectedLiveCluster]);

  const handleMapSalonClick = useCallback((salon: Salon) => {
    flyMapTo(salon.latitude, salon.longitude);
    if (isOwnActiveHostedSalon(salon)) {
      onOpenSalon?.(salon.id, salon.title, true);
      return;
    }
    openSalonPipFromMapSidebar(salon);
  }, [openSalonPipFromMapSidebar, flyMapTo, isOwnActiveHostedSalon, onOpenSalon]);

  const closeSalonSheet = useCallback(() => {
    dismissSalonSheetOnly();
    onCloseMapProfile?.();
  }, [dismissSalonSheetOnly, onCloseMapProfile]);

  const leaveSalonFromMap = useCallback(() => {
    dismissSalonSheetOnly();
    onCloseMapProfile?.();
    onLeaveSalon?.();
  }, [dismissSalonSheetOnly, onCloseMapProfile, onLeaveSalon]);

  const closeMapSheet = useCallback(() => {
    closeSalonSheet();
  }, [closeSalonSheet]);

  const onSalonCreated = useCallback((salon: Salon, lat: number, lon: number) => {
    setShowCreateSalon(false);
    setSalons((s) => [...s, salon]);
    setSalonSheetExpanded(false);
    setSafeCenter([lat, lon]);
    loadNearby(lat, lon);
    onOpenSalon?.(salon.id, salon.title, true);
    setSelected(null);
  }, [loadNearby, onOpenSalon, setSafeCenter]);

  useEffect(() => {
    if (!selected || !token || !user) return;
    if (selected.canJoin === false && selected.hostId !== user.id) return;
    const salonId = selected.id;
    const socket = getSocket();
    if (!socket) return;
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
    socket.on('salon_updated', onSalonUpdated);
    socket.on('salon_playback', onPlaybackSync);
    return () => {
      if (playbackSyncDebounceRef.current) clearTimeout(playbackSyncDebounceRef.current);
      socket.off('salon_updated', onSalonUpdated);
      socket.off('salon_playback', onPlaybackSync);
    };
  }, [selected?.id, selected?.canJoin, user?.id, token]);

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
      const salonForGate = selected?.id === salonId ? selected : null;
      const isHost = salonForGate?.hostId === user?.id;
      if (
        salonForGate &&
        user &&
        !canJoinSalonAsParticipant(salonForGate.platform, user.connectedPlatforms, isHost)
      ) {
        setToastMsg(t(salonParticipantAccessMessageKey(salonForGate.platform)));
        setSalonSheetExpanded(true);
        return;
      }
      clearMapInlineListenSession(salonId);
      onOpenSalon(salonId, selected?.id === salonId ? selected.title : undefined, isHost);
    },
    [onOpenSalon, selected, user, t]
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

  const mapSheetOpen = Boolean(selected);

  return (
    <div
      className={`ms-map-page relative flex-1 flex min-h-0 h-full w-full ${bottomMapList ? 'flex-col' : 'flex-row'}`}
    >
      {token && (
        <MapEventFilterSheet
          open={showEventFilterSheet}
          initialCriteria={eventFilterCriteria}
          profileCity={user?.city}
          onClose={() => setShowEventFilterSheet(false)}
          onApply={applyEventFilter}
          onPreviewCity={previewEventFilterCity}
        />
      )}

      {token && (
        <MapSalonFilterSheet
          open={showSalonFilterSheet}
          initialCriteria={salonFilterCriteria}
          profileCity={user?.city}
          onClose={() => setShowSalonFilterSheet(false)}
          onApply={applySalonFilter}
          onPreviewCity={previewSalonFilterCity}
        />
      )}

      {token && user && (
        <CreateSalonModal
          token={token}
          username={user.username}
          connectedPlatforms={user.connectedPlatforms}
          platformLinks={user.platformLinks}
          open={showCreateSalon}
          fallbackLatitude={nearbyQueryCenter[0]}
          fallbackLongitude={nearbyQueryCenter[1]}
          onClose={() => setShowCreateSalon(false)}
          onCreated={onSalonCreated}
          onUserUpdated={setUserFromProfile}
          onDeferredError={setToastMsg}
        />
      )}

      {token && user && <StartLiveFlowModals flow={liveStartFlow} />}

      {!bottomMapList && showNearbyPeople ? (
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
            onPersonClick={handleSidebarPersonClick}
            onSalonClick={handleSidebarSalonClick}
            onLiveClick={handleSidebarLiveClick}
            onHide={() => setNearbyPeopleVisible(false)}
            onEventClick={handleCityEventClick}
            onEventClusterClick={handleMapEventClusterClick}
            eventsFilterOn={eventsFilterOn}
            livesFilterOn={livesFilterOn}
            salonFilterOn={salonFilterOn}
          />
        )
      ) : !bottomMapList ? (
        <button
          type="button"
          onClick={() => setNearbyPeopleVisible(true)}
          title="Afficher la liste carte"
          aria-label="Afficher la liste carte"
          className="shrink-0 z-20 flex flex-col items-center justify-center gap-1 w-11 min-h-[44px] self-stretch bg-[var(--ms-surface)]/95 border-r border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
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

      <div className="ms-map-main-column relative flex-1 min-w-0 flex flex-col min-h-0">
        {!appa2 && !mapProfileOpen && (
          <MapAdBanner
            viewport={mapSponsorViewport}
            isActive={isActive && !mapProfileOpen}
            onCtaSalon={() => setShowCreateSalon(true)}
            onCtaLive={onOpenLiveTab}
          />
        )}

        <div className="ms-map-viewport relative flex-1 min-h-0">
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="px-4 py-2.5 rounded-xl bg-[#1a1a26] border border-white/15 text-sm text-white shadow-lg whitespace-nowrap">
              {toastMsg}
            </div>
          </div>
        )}
        {token &&
          user &&
          !mapProfileOpen &&
          !mapLivesBrowseOpen &&
          (mapActiveSalonSession || mapActiveLiveSession) &&
          onMapReturnToSalon &&
          onMapReturnToLive && (
            <MapActiveSessionOverlay
              token={token}
              user={user}
              salonSession={mapActiveSalonSession}
              liveSession={mapActiveLiveSession}
              onOpenSalon={onMapReturnToSalon}
              onOpenLive={onMapReturnToLive}
            />
          )}
        {loadingMapEvents && (
          <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a26]/90 border border-white/10 text-xs text-gray-300 shadow-lg backdrop-blur-sm">
              <svg className="w-3 h-3 animate-spin text-purple-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Chargement…</span>
            </div>
          </div>
        )}
        {selectedLiveCluster && (
          <MapLiveClusterSheet
            cluster={selectedLiveCluster}
            onClose={() => setSelectedLiveCluster(null)}
            onLiveClick={(live) => {
              setSelectedLiveCluster(null);
              handleMapLiveClick(live);
            }}
            onSalonClick={(salon) => {
              setSelectedLiveCluster(null);
              handleMapSalonClick(salon);
            }}
          />
        )}
        <div
          className={
            mapLivesBrowseOpen ? 'absolute inset-0 z-0 hidden pointer-events-none inert' : 'absolute inset-0 z-0'
          }
          aria-hidden={mapLivesBrowseOpen ? true : undefined}
        >
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
          recenterToken={mapRecenterToken}
          userPosition={mapUserPosition ?? undefined}
          onSelectSalon={handleMapSalonClick}
          onSelectLive={handleMapLiveClick}
          onSelectPerson={handleMapPersonClick}
          onSelectEventCluster={handleMapEventClusterClick}
          onSelectLiveCluster={handleMapLiveClusterClick}
          onMapBackgroundClick={handleMapBackgroundClick}
          mapStyle={mapStyle}
          onGlobeZoomToFlat={handleGlobeZoomToFlat}
          onPrepareFlatMap={handlePrepareFlatMap}
          onAutoSwitchToGlobe={handleAutoSwitchToGlobe}
          onGlobeUnavailable={handleGlobeUnavailable}
          onMapDetailStateChange={handleMapDetailStateChange}
          onGlobePovChange={handleGlobePovChange}
          onFlatMapViewportCenter={(lat, lng) => setMapViewportCenter([lat, lng])}
          onMapExplored={noteMapExplored}
          livesFilterOn={livesFilterOn}
          salonFilterOn={salonFilterOn}
          eventsFilterOn={eventsFilterOn}
        />
        </div>
        {mapLivesBrowseOpen && (
          <div className="absolute inset-0 z-[5] flex flex-col min-h-0 bg-[#0b0b0f]">
            <LivesBrowseGrid
              className="flex-1 min-h-0 h-full"
              onOpenLive={onOpenLive}
              isActive={isActive && mapLivesBrowseOpen}
            />
          </div>
        )}
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
          <div className="ms-map-salon-fab absolute bottom-4 left-3 z-30 pointer-events-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={liveStartFlow.startLive}
              disabled={liveStartFlow.starting || liveStartFlow.mediaSetupOpen}
              aria-label={t('map.createLiveFabAria', { defaultValue: 'Créer un live' })}
              className={`${MAP_CREATE_FAB_BTN} disabled:opacity-50`}
            >
              <span className={USERNAME_WAVE_CLASS}>+ Lives</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateSalon(true)}
              aria-label={t('home.createSalon', { defaultValue: 'Créer un salon musical' })}
              className={MAP_CREATE_FAB_BTN}
            >
              <span className={USERNAME_WAVE_CLASS}>+ Salon</span>
            </button>
          </div>
        )}

        <div className="ms-map-recenter-fab absolute bottom-4 right-3 z-30 flex flex-row items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={recenterMap}
            disabled={locating}
            title={recenterLabel}
            aria-label={recenterLabel}
            className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[var(--ms-surface)] border border-[var(--ms-border)] hover:border-indigo-500/60 text-indigo-400 shadow-lg disabled:opacity-50 active:scale-95 transition shrink-0"
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

        <div className="ms-map-filter-stack absolute top-3 left-3 z-30 inline-flex flex-col gap-2 pointer-events-auto">
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
              onClick={onSalonFilterClick}
              onPointerDown={onSalonFilterPointerDown}
              onPointerUp={onSalonFilterPointerUp}
              onPointerLeave={onSalonFilterPointerUp}
              onPointerCancel={onSalonFilterPointerUp}
              title={
                showSalonMarkers
                  ? t('map.salonFilterDisableTitle')
                  : t('map.salonFilterEnableTitle')
              }
              aria-label={
                showSalonMarkers
                  ? t('map.salonFilterDisableTitle')
                  : t('map.salonFilterEnableTitle')
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
                className={`${MAP_STACK_FILTER_BTN} ${
                  showEventMarkers
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                    : 'bg-[#12121a] border-[#2d2d3d] hover:border-purple-500/60 text-white/70 hover:text-purple-200'
                }`}
              >
                {showEventMarkers && loadingMapEvents && mapEvents.length === 0 ? (
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
          <div className="ms-map-globe-row flex items-center gap-1.5 w-full shrink-0">
            <button
              type="button"
              onClick={toggleMapLivesBrowse}
              title={
                mapLivesBrowseOpen
                  ? t('map.showMap', { defaultValue: 'Afficher la carte' })
                  : t('map.showLivesGrid', { defaultValue: 'Afficher les lives' })
              }
              aria-label={
                mapLivesBrowseOpen
                  ? t('map.showMap', { defaultValue: 'Afficher la carte' })
                  : t('map.showLivesGrid', { defaultValue: 'Afficher les lives' })
              }
              aria-pressed={mapLivesBrowseOpen}
              className={`${MAP_STACK_ICON_BTN} ${
                mapLivesBrowseOpen
                  ? 'bg-[var(--ms-surface)] border-purple-500 ring-2 ring-purple-500/40'
                  : 'border-[#232330] bg-[#131318] text-gray-400 hover:border-white/15 hover:text-white'
              }`}
            >
              {mapLivesBrowseOpen ? (
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 text-indigo-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                  <path d="M9 3v15M15 6v15" />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                </svg>
              )}
            </button>
            {!mapLivesBrowseOpen && (
            <button
              type="button"
              onClick={toggleMapStyle}
              title={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
              aria-label={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
              className={`${MAP_STACK_ICON_BTN} bg-[var(--ms-surface)] text-sm leading-none ${mapStyle === 'globe' ? 'border-indigo-500 text-indigo-300' : 'border-[var(--ms-border)] hover:border-indigo-500/60 text-white/70 hover:text-white'}`}
            >
              {mapStyle === 'globe' ? '🗺️' : '🌐'}
            </button>
            )}
          </div>
        </div>

        {selected && !isOwnActiveHostedSalon(selected) && (
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
            onLeaveSalon={onLeaveSalon ? leaveSalonFromMap : undefined}
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

        </div>

        {bottomMapList &&
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
                onPersonClick={handleSidebarPersonClick}
                onSalonClick={handleSidebarSalonClick}
                onLiveClick={handleSidebarLiveClick}
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
              className="shrink-0 z-20 flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 bg-[var(--ms-surface)]/95 border-t border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
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

      <MapEventDetailModal
        open={!!selectedMapEvent}
        marker={selectedMapEvent}
        post={selectedMapEventPost}
        savedEventPostIds={savedEventPostIds}
        onClose={() => setSelectedMapEvent(null)}
        onOpenInFeed={onOpenFeedPost}
        onPostUpdated={(postId, patch) => {
          const cached = mapEventPostsRef.current.get(postId);
          const next = cached
            ? { ...cached, ...patch }
            : selectedMapEvent?.id === postId
              ? ({
                  ...feedPostFromMapEventMarker(selectedMapEvent, null, savedEventPostIds),
                  ...patch,
                } as FeedPost)
              : null;
          if (next) {
            mapEventPostsRef.current.set(postId, next);
            setMapEventPostVersion((v) => v + 1);
          }
          if (patch.favoriteByMe !== undefined) {
            setSavedEventPostIds((prev) => {
              const next = new Set(prev);
              if (patch.favoriteByMe) next.add(postId);
              else next.delete(postId);
              return next;
            });
          }
        }}
        onOpenAuthor={(userId) => {
          if (!selectedMapEvent) return;
          const cached = mapEventPostsRef.current.get(selectedMapEvent.id);
          onOpenProfile({
            id: userId,
            username: cached?.author.username ?? selectedMapEvent.authorUsername ?? '',
            avatarUrl: cached?.author.avatarUrl ?? selectedMapEvent.authorAvatarUrl,
            usernameColor: cached?.author.usernameColor ?? selectedMapEvent.authorUsernameColor,
            usernameWaveFrom: cached?.author.usernameWaveFrom ?? selectedMapEvent.authorUsernameWaveFrom,
            usernameWaveTo: cached?.author.usernameWaveTo ?? selectedMapEvent.authorUsernameWaveTo,
          });
        }}
      />

    </div>
  );
}
