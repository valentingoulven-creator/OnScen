import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { MapView, type MapViewHandle, type MapStyle, MAP_GLOBE_FLAT_DO_SELECT_MS } from '../components/MapView';
import { MapZoomSlider } from '../components/MapZoomSlider';
import { MapEventSearchBar } from '../components/MapEventSearchBar';
import { MapOrganizerEventsPopup } from '../components/MapOrganizerEventsPopup';
import { NearbyPeoplePanel, type MapSidebarEventsBrowseConfig } from '../components/NearbyPeoplePanel';
import { MapCityEventsPanel } from '../components/MapCityEventsPanel';
import { MapLiveClusterSheet } from '../components/MapLiveClusterSheet';
import { MapMajorCityLiveSheet } from '../components/MapMajorCityLiveSheet';
import { MapEventDetailModal } from '../components/MapEventDetailModal';
import { MapEventMapInfoPanel } from '../components/MapEventMapInfoPanel';
import { MapEventFilterSheet } from '../components/MapEventFilterSheet';
import {
  MapSalonFilterSheet,
  getDefaultSalonFilterCriteria,
  hasSalonFilterCityLocation,
  type MapSalonFilterCriteria,
} from '../components/MapSalonFilterSheet';
import { MapSalonListenSheet } from '../components/MapSalonListenSheet';
import { CreateSalonModal } from '../components/CreateSalonModal';
import {
  CreateFeedEventModal,
  buildFeedEventContent,
  type FeedEventDraft,
} from '../components/CreateFeedEventModal';
import { StartLiveFlowModals } from '../components/StartLiveFlowModals';
import { useStartLiveFlow } from '../hooks/useStartLiveFlow';
import { useMapSidebarSponsoredEvents } from '../hooks/useMapSidebarSponsoredEvents';
import { useHomeGeoRefresh } from '../hooks/useHomeGeoRefresh';
import { useMapUserDisplayPosition, resolveMapCameraFallbackCenter } from '../lib/mapUserPosition';
import { canJoinSalonAsParticipant, ensureYoutubeLinkedToJoinSalon } from '../lib/platformConnect';
import { MapAdBanner, type MapSponsorViewport } from '../components/MapAdBanner';
import { MapActiveSessionOverlay } from '../components/MapActiveSessionOverlay';
import { MapCurrentFilterPopup, type MapActiveFilterKind } from '../components/MapCurrentFilterPopup';
import { MapEventsBrowseSheet } from '../components/MapEventsBrowseSheet';
import {
  MapSidebarBrowseSheet,
  collectGeoPointsFromLivesContent,
  collectGeoPointsFromSalonContent,
  uniqueLiveCountFromContent,
  uniqueSalonCountFromContent,
} from '../components/MapSidebarBrowseSheet';
import { FilterIcon } from '../components/FilterIcon';
import {
  dispatchMapEventsRefresh,
  MAP_EVENTS_REFRESH_EVENT,
  MAP_OPEN_CREATE_SALON_EVENT,
} from '../lib/mapUiEvents';
import { writeSavedEventLocation } from '../lib/savedEventLocation';
import { validateStoryLinkUrl } from '../lib/storyLink';
import { isAppa2Layout, type AppLayoutId } from '../lib/appLayout';
import { useCompactMapViewport } from '../hooks/usePhoneWebViewport';
import {
  createDefaultEventFilter,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  filterMapEventsByCriteria,
  filterMapEventsOnCalendarDay,
  filterMapEventPinsForView,
  getBrowseSheetCalendarDayKeys,
  getEventFilterCityMapRadiusKm,
  hasEventFilterCityLocation,
  resolveDefaultEventFilterLocation,
  type MapEventFilterCriteria,
} from '../lib/mapEventFilter';
import { applySavedEventFavoriteState, feedPostFromMapEventMarker, loadMapEventMarkers, buildMapEventMarkersFromPosts, buildMapEventMarkersFromSponsoredPosts, mergeMapEventMarkers } from '../lib/mapFeedEvents';
import { getPrimaryEventDate, isMapEventVisibleAsSponsoPin, mergeBrowseDayKeysForMapPosts } from '../lib/feedEvents';
import { resolveEventCoords, resolveEventCoordsSync } from '../lib/mapEventCoords';
import { clusterMapEventsByLocation, extractCityFromLocation, flattenEventClustersToMarkers, sortMapEventsForPanel } from '../lib/mapEventClusters';
import {
  getMapSearchFlyRadiusKm,
  MAP_FLY_TO_PLACE_EVENT,
  takePendingMapFlyToPlace,
  type MapSearchSearchIntent,
} from '../lib/mapSearchIntent';
import { scheduleMapFlyWhenReady } from '../lib/mapFlyWhenReady';
import type { MapLiveLocationCluster } from '../lib/mapLiveClusters';
import {
  applyGlobeLiveAudienceFilterToSalons,
  filterGlobeLiveMarkersAboveAverageAudience,
} from '../lib/globeLiveAudience';
import { isActiveMapLive, purgeEndedLiveFromMapState } from '../lib/mapLiveEndSync';
import type { MapMajorCityLiveCluster } from '../lib/mapMajorCityLiveClusters';
import {
  buildMapSidebarContent,
  countLivesFilterBadge,
  countMapSidebarItems,
  countSalonsSidebarItems,
  isSidebarFollowingEvent,
} from '../lib/mapSidebarContent';
import {
  clipLivesForMapView,
  clipPeopleForMapView,
  clipSalonsForMapView,
  filterEventClustersInViewport,
  filterEventClustersInGlobeRegion,
  filterMarkersInViewport,
  getGlobeCapitalVisibleRadiusKm,
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
import { flatZoomToNorm, type MapZoomControlSnapshot } from '../lib/mapZoomControl';
import type { PlaceSearchHit } from '../lib/placeSearch';
import type {
  MapEventSearchEventHit,
  MapEventSearchOrganizerHit,
} from '../lib/mapEventSearch';
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
import {
  applyFollowingChanged,
  FOLLOWING_CHANGED_EVENT,
  type FollowingChangedDetail,
} from '../lib/followingSync';
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
/** Recentrer : cadre ~30 km autour du lieu (aligné filtre / onglet Autour). */
const MAP_RECENTER_RADIUS_KM = DEFAULT_EVENT_FILTER_RADIUS_KM;
/** Cadrage « Voir sur la carte » pour un événement ponctuel (lieu / venue). */
const MAP_EVENT_DETAIL_FLY_RADIUS_KM = 5;
/** Clic carte sidebar — zoom serré sur le lieu (sans modal). */
const MAP_SIDEBAR_EVENT_FLY_RADIUS_KM = 1.2;
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
  const { user, token, authBootPending, setUserFromProfile } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<NearbyPerson[]>([]);
  const [selected, setSelected] = useState<Salon | null>(null);
  const [center, setCenter] = useState<[number, number]>(() =>
    resolveMapCameraFallbackCenter(user?.city)
  );
  const mapRecenterTokenRef = useRef(0);
  const [mapRecenterToken, setMapRecenterToken] = useState(0);
  /** Après pan carte ou rotation globe — ne pas ramener le viewport sur le GPS tardif. */
  const mapExploredRef = useRef(false);
  /** Ignore bounds-driven nearby reloads pendant flyTo programmé (recherche / recenter). */
  const programmaticMapMoveUntilRef = useRef(0);
  /** Seuil recentrage carte (~10 m) — évite flyTo en boucle sur jitter GPS / bootstrap geo. */
  const setSafeCenter = useCallback((coords: [number, number]) => {
    const bumpRecenter = () => {
      mapRecenterTokenRef.current += 1;
      setMapRecenterToken(mapRecenterTokenRef.current);
    };
    if (!isValidLatLng(coords[0], coords[1])) {
      setCenter((prev) => {
        if (prev[0] === DEFAULT_CENTER[0] && prev[1] === DEFAULT_CENTER[1]) return prev;
        bumpRecenter();
        return [...DEFAULT_CENTER];
      });
      return;
    }
    const next = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
    setCenter((prev) => {
      if (getDistanceKm(prev[0], prev[1], next[0], next[1]) < 0.01) return prev;
      bumpRecenter();
      return next;
    });
  }, []);
  const setMapViewportCenter = useCallback((coords: [number, number]) => {
    if (!isValidLatLng(coords[0], coords[1])) return;
    mapExploredRef.current = true;
    setCenter((prev) => {
      const next = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
      if (getDistanceKm(prev[0], prev[1], next[0], next[1]) < 0.01) return prev;
      return next;
    });
  }, []);
  const noteMapExplored = useCallback(() => {
    mapExploredRef.current = true;
  }, []);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventPublishing, setEventPublishing] = useState(false);
  /** Vue grille lives à la place de la carte (toggle logo). */
  const [mapFilterPopupOpen, setMapFilterPopupOpen] = useState(false);
  const [showEventsBrowseSheet, setShowEventsBrowseSheet] = useState(false);
  const [showLivesBrowseSheet, setShowLivesBrowseSheet] = useState(false);
  const [showSalonBrowseSheet, setShowSalonBrowseSheet] = useState(false);
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
  const lastHandledMapSearchFlyNonceRef = useRef(0);
  const mapSearchFlyCancelRef = useRef<(() => void) | null>(null);
  const mapAnchorFlyCancelRef = useRef<(() => void) | null>(null);
  const mapRecenterFlyCancelRef = useRef<(() => void) | null>(null);
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
  /** Filtre événement ouvert + Appliquer dans la sheet (plage / type / lieu explicites). */
  const [eventFilterCustomized, setEventFilterCustomized] = useState(false);
  /** Pin jour sidebar browse : filtre carte/globe sur un seul jour (toggle). */
  const [mapEventDayPinFilter, setMapEventDayPinFilter] = useState<string | null>(null);
  const [showEventFilterSheet, setShowEventFilterSheet] = useState(false);
  const [showSalonFilterSheet, setShowSalonFilterSheet] = useState(false);
  const [salonFilterCriteria, setSalonFilterCriteria] = useState<MapSalonFilterCriteria>(() =>
    getDefaultSalonFilterCriteria()
  );
  useEffect(() => {
    if (!showEventFilterSheet) lastEventFilterCityFlyRef.current = null;
  }, [showEventFilterSheet]);
  useEffect(() => {
    if (!showSalonFilterSheet) lastSalonFilterCityFlyRef.current = null;
  }, [showSalonFilterSheet]);
  useEffect(() => {
    if (eventFilterCustomized) return;
    const applyDefaultLocation = () => {
      const defaults = resolveDefaultEventFilterLocation(user?.city);
      if (!defaults.location) return;
      setEventFilterCriteria((prev) => ({
        ...prev,
        location: defaults.location,
        latitude: defaults.latitude,
        longitude: defaults.longitude,
      }));
    };
    applyDefaultLocation();
    window.addEventListener(MAP_GEO_CHANGED_EVENT, applyDefaultLocation);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, applyDefaultLocation);
  }, [user?.city, eventFilterCustomized]);

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
  const [mapSponsoredEventMarkers, setMapSponsoredEventMarkers] = useState<MapEventMarker[]>([]);
  const [mapEventsRefreshKey, setMapEventsRefreshKey] = useState(0);
  const eventFilterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventFilterLongPressTriggeredRef = useRef(false);
  const salonFilterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salonFilterLongPressTriggeredRef = useRef(false);
  const [loadingMapEvents, setLoadingMapEvents] = useState(false);
  const [selectedEventCluster, setSelectedEventCluster] = useState<MapEventCityCluster | null>(null);
  const [selectedLiveCluster, setSelectedLiveCluster] = useState<MapLiveLocationCluster | null>(null);
  const [selectedMajorCityCluster, setSelectedMajorCityCluster] =
    useState<MapMajorCityLiveCluster | null>(null);
  const [selectedMapEvent, setSelectedMapEvent] = useState<MapEventMarker | null>(null);
  /** Pin événement surligné sur la carte (clic sidebar — zoom sans modal). */
  const [highlightedMapEventId, setHighlightedMapEventId] = useState<string | null>(null);
  /** Fiche événement ancrée sur la carte (pin) — sans modal plein écran. */
  const [mapFocusedEvent, setMapFocusedEvent] = useState<MapEventMarker | null>(null);
  /** Popup détail événement ouvert depuis la recherche carte (indépendant du filtre sidebar). */
  const [mapSearchEventModal, setMapSearchEventModal] = useState<{
    marker: MapEventMarker;
    post: FeedPost | null;
  } | null>(null);
  const [mapSearchOrganizerModal, setMapSearchOrganizerModal] =
    useState<MapEventSearchOrganizerHit | null>(null);
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
  const [mapZoomControl, setMapZoomControl] = useState<MapZoomControlSnapshot>(() => ({
    norm: flatZoomToNorm(14),
    mode: 'flat',
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
    const onFollowingChanged = (event: Event) => {
      const detail = (event as CustomEvent<FollowingChangedDetail>).detail;
      if (!detail?.userId) return;
      setFollowingIds((prev) => applyFollowingChanged(prev, detail.userId, detail.following));
      if (detail.salon) {
        setSalons((prev) =>
          prev.some((s) => s.id === detail.salon!.id) ? prev : [...prev, detail.salon!]
        );
      }
      if (detail.live && isActiveMapLive(detail.live)) {
        setLives((prev) =>
          prev.some((l) => l.id === detail.live!.id) ? prev : [...prev, detail.live!]
        );
      }
    };
    window.addEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged);
    return () => window.removeEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged);
  }, []);

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
    const post =
      cached ?? feedPostFromMapEventMarker(selectedMapEvent, null, savedEventPostIds);
    return applySavedEventFavoriteState(post, savedEventPostIds);
  }, [selectedMapEvent, savedEventPostIds, mapEventPostVersion]);

  const mapFocusedEventPost = useMemo(() => {
    if (!mapFocusedEvent) return null;
    void mapEventPostVersion;
    const cached = mapEventPostsRef.current.get(mapFocusedEvent.id);
    return (
      cached ?? feedPostFromMapEventMarker(mapFocusedEvent, null, savedEventPostIds)
    );
  }, [mapFocusedEvent, savedEventPostIds, mapEventPostVersion]);

  const mapSearchEventPost = useMemo(() => {
    if (!mapSearchEventModal) return null;
    void mapEventPostVersion;
    const cached =
      mapSearchEventModal.post ?? mapEventPostsRef.current.get(mapSearchEventModal.marker.id);
    if (cached) return applySavedEventFavoriteState(cached, savedEventPostIds);
    return feedPostFromMapEventMarker(mapSearchEventModal.marker, null, savedEventPostIds);
  }, [mapSearchEventModal, savedEventPostIds, mapEventPostVersion]);

  const mapEventPostsMap = useMemo(() => {
    void mapEventPostVersion;
    return new Map(mapEventPostsRef.current);
  }, [mapEventPostVersion, mapEvents]);

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
    nearbyPanelPrefs.salonAffinityGenres,
    nearbyPanelPrefs.salonAffinityGenreOptions,
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
    const filtered = filterLivesForMap(lives, filteredNearbyPeople, nearbyPanelPrefs).filter(
      (l) => isValidLatLng(l.latitude, l.longitude) && isActiveMapLive(l)
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
  const hasFollowingMapSources = followingIds.size > 0 || savedEventPostIds.size > 0;
  /** Sans filtre carte : pins des contenus suivis / enregistrés (sidebar Suivi). */
  const followingMapAmbientOn = !anyMapFilterActive && hasFollowingMapSources;
  /** Rechargement nearby au centre viewport (carte / globe). */
  const mapFilterViewportOn = livesFilterOn || salonFilterOn;

  /** GPS si disponible, sinon ville profil ; masqué en mode fantôme. */
  const mapUserDisplay = useMapUserDisplayPosition(
    userPosition,
    user?.city,
    user?.isGhostMode
  );

  /** Masque capitales globe/carte plate quand seul le filtre Évènement est actif. */
  const mapEventsOnly = eventsFilterOn && !livesFilterOn && !salonFilterOn;

  const showAllSalonsAtCityZoom = shouldShowAllSalonsAtCityZoom(salonFilterOn) || followingMapAmbientOn;

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
  const mapDetailGlobeAltitude = mapDetailState.globeAltitude;

  /** Vue globe overview : sonars live visibles sans activer le filtre Lives. */
  const globeLiveAmbientOn =
    mapDetailMapStyle === 'globe' && mapDetailTier === 'overview';

  /** Vue globe (tout zoom) : événements du jour visibles sans activer le filtre Évènement. */
  const globeEventAmbientOn = mapDetailMapStyle === 'globe';

  /**
   * Le panneau latéral (liste) doit refléter exactement ce qui s'affiche sur le globe,
   * y compris en mode « ambiant » (pins visibles sans que le filtre correspondant soit activé) —
   * sinon la liste reste vide alors que le globe montre déjà des lives/événements.
   * Suivi/Enregistré est inclus automatiquement (sections gérées par NearbyPeoplePanel).
   */
  const sidebarLivesFilterOn = livesFilterOn || globeLiveAmbientOn;
  const sidebarEventsFilterOn = eventsFilterOn || globeEventAmbientOn;

  const rawMapSalonsForView = useMemo(() => {
    if (!anyMapFilterActive && !globeLiveAmbientOn && !followingMapAmbientOn) return [];

    const merged = new Map<string, Salon>();
    const addSalons = (list: Salon[]) => {
      for (const salon of list) {
        if (!isValidLatLng(salon.latitude, salon.longitude)) continue;
        merged.set(salon.id, salon);
      }
    };

    if (followingMapAmbientOn) {
      addSalons(salons.filter((s) => isPublicSalon(s) && followingIds.has(s.hostId)));
    } else if (salonFilterOn) {
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
    followingMapAmbientOn,
    followingIds,
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

  const rawMapLivesForView = useMemo(() => {
    if (!anyMapFilterActive && !globeLiveAmbientOn && !followingMapAmbientOn) return [];
    if (followingMapAmbientOn && !livesFilterOn && !globeLiveAmbientOn) {
      return mapLives.filter((l) => followingIds.has(l.hostId));
    }
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
    followingMapAmbientOn,
    followingIds,
    globeLiveAmbientOn,
    livesFilterOn,
    mapLives,
    mapDetailBounds,
    mapDetailMapStyle,
    mapDetailTier,
    nearbyFetchCenter,
  ]);

  const liveAudienceFilterActive =
    !livesFilterOn &&
    !followingMapAmbientOn &&
    (globeLiveAmbientOn || rawMapLivesForView.length > 0);

  const globeLiveAudienceFiltered = useMemo(() => {
    if (!liveAudienceFilterActive) return null;
    return filterGlobeLiveMarkersAboveAverageAudience(rawMapLivesForView, rawMapSalonsForView);
  }, [liveAudienceFilterActive, rawMapLivesForView, rawMapSalonsForView]);

  const mapLivesForView = useMemo(
    () => (globeLiveAudienceFiltered ? globeLiveAudienceFiltered.lives : rawMapLivesForView),
    [globeLiveAudienceFiltered, rawMapLivesForView]
  );

  const mapSalonsForView = useMemo(
    () =>
      globeLiveAudienceFiltered
        ? applyGlobeLiveAudienceFilterToSalons(
            rawMapSalonsForView,
            globeLiveAudienceFiltered.liveSalons
          )
        : rawMapSalonsForView,
    [globeLiveAudienceFiltered, rawMapSalonsForView]
  );

  const mapEventsIncludingSponso = useMemo(
    () => mergeMapEventMarkers(mapEvents, mapSponsoredEventMarkers),
    [mapEvents, mapSponsoredEventMarkers]
  );

  const filteredMapEvents = useMemo(
    () => filterMapEventsByCriteria(mapEventsIncludingSponso, eventFilterCriteria, { viewerId: user?.id }),
    [mapEventsIncludingSponso, eventFilterCriteria, user?.id]
  );

  /** Événements carte / sidebar (sans filtre jour pin). Sponso : dates non passées. */
  const mapEventsBaseForPins = useMemo(() => {
    let base: MapEventMarker[];
    if (followingMapAmbientOn && !eventsFilterOn) {
      base = sortMapEventsForPanel(
        mapEvents.filter((event) =>
          isSidebarFollowingEvent(event, followingIds, savedEventPostIds)
        ),
        favoriteIds
      );
    } else {
      base = filterMapEventPinsForView(mapEventsIncludingSponso, {
        eventsFilterOn,
        globeOverview: mapDetailMapStyle === 'globe' && mapDetailTier === 'overview',
        filteredWhenCriteria: filteredMapEvents,
        merge: mergeMapEventMarkers,
      });
    }

    const sponso = mapSponsoredEventMarkers.filter((marker) =>
      isMapEventVisibleAsSponsoPin(marker)
    );
    if (sponso.length === 0) return base;
    return mergeMapEventMarkers(
      base.filter((marker) => !marker.isSponsored),
      sponso
    );
  }, [
    eventsFilterOn,
    favoriteIds,
    filteredMapEvents,
    followingIds,
    followingMapAmbientOn,
    mapDetailMapStyle,
    mapDetailTier,
    mapEvents,
    mapEventsIncludingSponso,
    mapSponsoredEventMarkers,
    savedEventPostIds,
  ]);

  /** Pins carte uniquement — peut restreindre à un jour (bouton pin section sidebar). */
  const mapEventsForMapPins = useMemo(() => {
    if (mapEventDayPinFilter && eventsFilterOn) {
      return filterMapEventsOnCalendarDay(mapEventsBaseForPins, mapEventDayPinFilter);
    }
    return mapEventsBaseForPins;
  }, [mapEventsBaseForPins, mapEventDayPinFilter, eventsFilterOn]);

  const mapEventAuthorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of mapEventsForMapPins) {
      if (event.authorId) ids.add(event.authorId);
    }
    return ids.size > 0 ? ids : undefined;
  }, [mapEventsForMapPins]);

  const mapPeople = useMemo(
    () => peopleMarkersOnMap(filteredNearbyPeople, mapEventAuthorIds),
    [filteredNearbyPeople, mapEventAuthorIds]
  );

  const mapPeopleForView = useMemo(() => {
    if (!anyMapFilterActive) return [];
    if (!livesFilterOn) return [];
    return clipPeopleForMapView(
      mapPeople,
      { bounds: mapDetailBounds, mapStyle: mapDetailMapStyle },
      nearbyFetchCenter
    );
  }, [anyMapFilterActive, livesFilterOn, mapPeople, mapDetailBounds, mapDetailMapStyle, nearbyFetchCenter]);

  const mapEventClusters = useMemo(
    () => clusterMapEventsByLocation(mapEventsBaseForPins),
    [mapEventsBaseForPins]
  );

  const mapEventClustersOnMap = useMemo(
    () => clusterMapEventsByLocation(mapEventsForMapPins),
    [mapEventsForMapPins]
  );

  const clipEventClustersToViewport = useCallback(
    (clusters: MapEventCityCluster[]) => {
      if (mapDetailTier === 'overview') return clusters;

      if (mapDetailMapStyle === 'globe') {
        const radiusKm = getGlobeCapitalVisibleRadiusKm(mapDetailGlobeAltitude ?? 0.6);
        return filterEventClustersInGlobeRegion(clusters, center[0], center[1], radiusKm);
      }

      if (!mapDetailBounds) return clusters;
      const clipped = filterEventClustersInViewport(
        clusters,
        mapDetailBounds,
        mapDetailTier
      );
      if (clipped.length === 0 && clusters.length > 0) return clusters;
      return clipped;
    },
    [mapDetailMapStyle, mapDetailBounds, mapDetailTier, mapDetailGlobeAltitude, center]
  );

  /**
   * Clusters visibles sur la carte : viewport + filtre jour pin optionnel.
   */
  const mapEventClustersForMap = useMemo(() => {
    const skipViewportClip =
      (followingMapAmbientOn && !eventsFilterOn) ||
      (sidebarEventsFilterOn && mapSponsoredEventMarkers.length > 0);
    if (skipViewportClip) {
      return mapEventClustersOnMap;
    }
    return clipEventClustersToViewport(mapEventClustersOnMap);
  }, [
    clipEventClustersToViewport,
    eventsFilterOn,
    followingMapAmbientOn,
    mapEventClustersOnMap,
    mapSponsoredEventMarkers.length,
    sidebarEventsFilterOn,
  ]);

  /** Onglet Autour : aligné sur les pins carte (même clusters que mapEventClustersForMap). */
  const browseAroundEventPosts = useMemo((): FeedPost[] | undefined => {
    if (!sidebarEventsFilterOn) return undefined;
    void mapEventPostVersion;
    const markers = flattenEventClustersToMarkers(mapEventClustersForMap);
    return markers
      .map((marker) => {
        const cached = mapEventPostsRef.current.get(marker.id);
        return feedPostFromMapEventMarker(marker, cached, savedEventPostIds);
      })
      .sort((a, b) => {
        const aDate = getPrimaryEventDate(a);
        const bDate = getPrimaryEventDate(b);
        if (aDate && bDate) {
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        }
        return 0;
      });
  }, [sidebarEventsFilterOn, mapEventClustersForMap, savedEventPostIds, mapEventPostVersion]);

  /** Jours browse — couleurs pins carte (même fenêtre que sidebar / sheet). */
  const mapEventBrowseDayKeys = useMemo((): string[] | undefined => {
    if (!eventsFilterOn) return undefined;
    const useFilterDays = eventFilterCustomized;
    const base = getBrowseSheetCalendarDayKeys(
      useFilterDays ? eventFilterCriteria : undefined,
      useFilterDays
    );
    if (!eventFilterCustomized || browseAroundEventPosts === undefined) return base;
    return mergeBrowseDayKeysForMapPosts(base, browseAroundEventPosts);
  }, [
    eventsFilterOn,
    eventFilterCustomized,
    eventFilterCriteria,
    browseAroundEventPosts,
  ]);

  const mapEventBrowsePinFallbackNearest = Boolean(
    eventFilterCustomized && browseAroundEventPosts !== undefined
  );

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
        eventsFilterOn: sidebarEventsFilterOn,
        livesFilterOn: sidebarLivesFilterOn,
        salonFilterOn,
        eventsOnly: mapEventsOnly,
        showAllSalonsAtCityZoom,
        mapEvents: mapEventsBaseForPins,
        eventClusters: mapEventClusters,
        lives: mapLives,
        salons: salonFilterOn ? salons : mapSalonsForView,
        people: mapPeople,
        favoriteIds,
        followingIds,
        savedEventPostIds,
        allMapEvents: mapEvents,
        allSalons: salons,
        nearbyFetchCenter,
      }),
    [
      mapDetailTier,
      mapDetailMapStyle,
      mapDetailBounds,
      sidebarEventsFilterOn,
      sidebarLivesFilterOn,
      salonFilterOn,
      showAllSalonsAtCityZoom,
      mapEventsOnly,
      mapEventsBaseForPins,
      mapEventClusters,
      mapLives,
      mapSalonsForView,
      salons,
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

  /** Badge filtre Évènement : événements visibles dans le viewport carte/globe. */
  const eventsFilterBadgeCount = eventsFilterOn
    ? flattenEventClustersToMarkers(mapEventClustersForMap).length
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

  const sidebarSponsoredEvents = useMapSidebarSponsoredEvents(token);
  const sponsoredEventPostIdsKey = useMemo(
    () => sidebarSponsoredEvents.posts.map((post) => post.id).join(','),
    [sidebarSponsoredEvents.posts]
  );

  useEffect(() => {
    if (!token || sidebarSponsoredEvents.posts.length === 0) {
      setMapSponsoredEventMarkers([]);
      return;
    }

    for (const post of sidebarSponsoredEvents.posts) {
      mapEventPostsRef.current.set(post.id, post);
    }
    setMapEventPostVersion((v) => v + 1);

    let cancelled = false;
    void buildMapEventMarkersFromSponsoredPosts(sidebarSponsoredEvents.posts, {
      signal: { cancelled },
      onProgress: (partial) => {
        if (!cancelled && partial.length > 0) setMapSponsoredEventMarkers(partial);
      },
    }).then((markers) => {
      if (!cancelled) setMapSponsoredEventMarkers(markers);
    });

    return () => {
      cancelled = true;
    };
  }, [token, sponsoredEventPostIdsKey, sidebarSponsoredEvents.posts]);

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
    setShowEventsBrowseSheet(false);
    setMapEventDayPinFilter(null);
    setEventFilterCustomized(false);
    setEventFilterCriteria(createDefaultEventFilter(user?.city));
  }, [user?.city]);

  const handleMapEventDayPinFilter = useCallback((dayKey: string) => {
    setMapEventDayPinFilter((prev) => (prev === dayKey ? null : dayKey));
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
        setShowSalonBrowseSheet(false);
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
      setShowLivesBrowseSheet(false);
      return;
    }
    deactivateMapContentFiltersExcept('lives');
    setNearbyPanelPreferences({ livesOnly: true });
  }, [nearbyPanelPrefs.livesOnly, deactivateMapContentFiltersExcept]);

  const openMapFilterPopup = useCallback(() => {
    if (eventsFilterOn) {
      setShowEventsBrowseSheet(true);
      setNearbyPeopleVisible(true);
      return;
    }
    if (livesFilterOn) {
      setShowLivesBrowseSheet(true);
      setNearbyPeopleVisible(true);
      return;
    }
    if (salonFilterOn) {
      setShowSalonBrowseSheet(true);
      setNearbyPeopleVisible(true);
      return;
    }
    setMapFilterPopupOpen(true);
  }, [eventsFilterOn, livesFilterOn, salonFilterOn, setNearbyPeopleVisible]);

  const activeMapFilterKind = useMemo((): MapActiveFilterKind => {
    if (livesFilterOn) return 'lives';
    if (salonFilterOn) return 'salon';
    if (eventsFilterOn) return 'events';
    return null;
  }, [livesFilterOn, salonFilterOn, eventsFilterOn]);

  const activeMapFilterCount = useMemo(() => {
    if (livesFilterOn) return livesFilterBadgeCount;
    if (salonFilterOn) return salonFilterBadgeCount;
    if (eventsFilterOn) return eventsFilterBadgeCount;
    return 0;
  }, [
    livesFilterOn,
    salonFilterOn,
    eventsFilterOn,
    livesFilterBadgeCount,
    salonFilterBadgeCount,
    eventsFilterBadgeCount,
  ]);

  const mapBrowsePopupTitle = useMemo(() => {
    if (eventsFilterOn) {
      return t('map.eventsBrowseOpenTitle', {
        defaultValue: 'Voir les événements autour et dans votre pays',
      });
    }
    if (livesFilterOn) {
      return t('map.livesBrowseOpenTitle', { defaultValue: 'Voir les lives sur la carte' });
    }
    if (salonFilterOn) {
      return t('map.salonBrowseOpenTitle', { defaultValue: 'Voir les salons sur la carte' });
    }
    return t('map.currentFilterPopupTitle', { defaultValue: 'Filtre carte actif' });
  }, [eventsFilterOn, livesFilterOn, salonFilterOn, t]);

  const anyBrowseSheetOpen =
    mapFilterPopupOpen || showEventsBrowseSheet || showLivesBrowseSheet || showSalonBrowseSheet;

  const disableSalonFilter = useCallback(() => {
    pendingMapFilterNearbyReloadRef.current = true;
    clearNearbyCache();
    setShowSalonMarkers(false);
    setShowSalonFilterSheet(false);
    setShowSalonBrowseSheet(false);
  }, []);

  const clearSalonFilterLongPress = useCallback(() => {
    if (salonFilterLongPressRef.current) {
      clearTimeout(salonFilterLongPressRef.current);
      salonFilterLongPressRef.current = null;
    }
  }, []);

  const openSalonFilterSheet = useCallback(() => {
    if (!showSalonMarkers) {
      deactivateMapContentFiltersExcept(null);
    }
    setSalonFilterCriteria(getDefaultSalonFilterCriteria());
    setShowSalonFilterSheet(true);
  }, [showSalonMarkers, deactivateMapContentFiltersExcept]);

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

  const applySalonFilter = useCallback(
    (criteria: MapSalonFilterCriteria) => {
      deactivateMapContentFiltersExcept('salon');
      setSalonFilterCriteria(criteria);
      setNearbyPanelPreferences({
        sortBy: 'none',
        musicalAffinitiesOnly: criteria.affinityGenres != null,
        salonAffinityGenres: criteria.affinityGenres,
        salonAffinityGenreOptions: criteria.affinityGenreOptions,
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
    [deactivateMapContentFiltersExcept, flyToSalonFilterBounds, setNearbyPeopleVisible]
  );

  const toggleSalonFilter = useCallback(() => {
    if (showSalonMarkers) {
      disableSalonFilter();
      return;
    }
    applySalonFilter(getDefaultSalonFilterCriteria());
  }, [showSalonMarkers, disableSalonFilter, applySalonFilter]);

  const onSalonFilterPointerDown = useCallback(() => {
    salonFilterLongPressTriggeredRef.current = false;
    clearSalonFilterLongPress();
    salonFilterLongPressRef.current = setTimeout(() => {
      salonFilterLongPressTriggeredRef.current = true;
      openSalonFilterSheet();
    }, 600);
  }, [clearSalonFilterLongPress, openSalonFilterSheet]);

  const onSalonFilterPointerUp = useCallback(() => {
    clearSalonFilterLongPress();
  }, [clearSalonFilterLongPress]);

  const onSalonFilterClick = useCallback(() => {
    clearSalonFilterLongPress();
    if (salonFilterLongPressTriggeredRef.current) {
      salonFilterLongPressTriggeredRef.current = false;
      return;
    }
    toggleSalonFilter();
  }, [clearSalonFilterLongPress, toggleSalonFilter]);

  const openEventFilterSheet = useCallback(() => {
    if (!showEventMarkers) {
      deactivateMapContentFiltersExcept(null);
    }
    setShowEventFilterSheet(true);
  }, [showEventMarkers, deactivateMapContentFiltersExcept]);

  const toggleEventsFilter = useCallback(() => {
    if (showEventMarkers) {
      disableEventsFilter();
      return;
    }
    deactivateMapContentFiltersExcept('events');
    setEventFilterCustomized(false);
    setShowEventMarkers(true);
    setShowEventFilterSheet(false);
    setNearbyPeopleVisible(true);
  }, [showEventMarkers, disableEventsFilter, deactivateMapContentFiltersExcept, setNearbyPeopleVisible]);

  /** Cadre carte / globe sur GPS ou ville profil (ouverture onglet Carte, bootstrap geo). */
  const applyMapViewportCenter = useCallback((
    coords: [number, number],
    opts?: { switchGlobeToFlat?: boolean }
  ) => {
    const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
    programmaticMapMoveUntilRef.current = Date.now() + 2500;

    mapRecenterTokenRef.current += 1;
    setMapRecenterToken(mapRecenterTokenRef.current);
    setCenter(safe);

    mapAnchorFlyCancelRef.current?.();
    mapAnchorFlyCancelRef.current = scheduleMapFlyWhenReady(
      () => mapViewRef.current,
      (handle) => {
        const flyDurationSec = opts?.switchGlobeToFlat ? 1.2 : 1.0;
        if (mapStyle === 'globe' && opts?.switchGlobeToFlat) {
          handle.prepareFlatAt(safe[0], safe[1], undefined, MAP_RECENTER_RADIUS_KM);
          setMapStyle('flat');
          localStorage.setItem(MAP_STYLE_KEY, 'flat');
          window.setTimeout(() => {
            const active = mapViewRef.current;
            if (active?.isMapReady()) {
              active.invalidateSize();
              active.recenterToBounds(safe[0], safe[1], MAP_RECENTER_RADIUS_KM, {
                durationSec: flyDurationSec,
              });
            }
          }, MAP_GLOBE_FLAT_DO_SELECT_MS);
        } else if (mapStyle === 'globe') {
          handle.prepareFlatAt(safe[0], safe[1], undefined, MAP_RECENTER_RADIUS_KM);
          handle.flyToGlobe(safe[0], safe[1], 0.45, 900);
        } else {
          handle.invalidateSize();
          if (opts?.switchGlobeToFlat) {
            handle.recenterToBounds(safe[0], safe[1], MAP_RECENTER_RADIUS_KM, {
              durationSec: flyDurationSec,
            });
          } else {
            handle.jumpToCityBounds(safe[0], safe[1], MAP_RECENTER_RADIUS_KM);
          }
          window.setTimeout(() => mapViewRef.current?.invalidateSize(), 80);
        }
        mapAnchorFlyCancelRef.current = null;
      }
    );
  }, [mapStyle]);

  /** FAB « ma position » — cadrage direct sans recenterToken (évite conflits Leaflet). */
  const flyMapRecenter = useCallback((coords: [number, number]) => {
    const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
    mapExploredRef.current = false;
    programmaticMapMoveUntilRef.current = Date.now() + 2500;
    setCenter(safe);

    const runFly = (handle: MapViewHandle) => {
      if (mapStyle === 'globe') {
        handle.prepareFlatAt(safe[0], safe[1], undefined, MAP_RECENTER_RADIUS_KM);
        setMapStyle('flat');
        localStorage.setItem(MAP_STYLE_KEY, 'flat');
        window.setTimeout(() => {
          const active = mapViewRef.current;
          if (!active?.isMapReady()) return;
          active.invalidateSize();
          active.jumpToCityBounds(safe[0], safe[1], MAP_RECENTER_RADIUS_KM);
          window.setTimeout(() => mapViewRef.current?.invalidateSize(), 80);
        }, MAP_GLOBE_FLAT_DO_SELECT_MS);
        return;
      }
      handle.invalidateSize();
      handle.jumpToCityBounds(safe[0], safe[1], MAP_RECENTER_RADIUS_KM);
      window.setTimeout(() => mapViewRef.current?.invalidateSize(), 80);
    };

    mapRecenterFlyCancelRef.current?.();
    const ready = mapViewRef.current;
    if (ready?.isMapReady()) {
      runFly(ready);
    } else {
      mapRecenterFlyCancelRef.current = scheduleMapFlyWhenReady(
        () => mapViewRef.current,
        (handle) => {
          runFly(handle);
          mapRecenterFlyCancelRef.current = null;
        }
      );
    }
  }, [mapStyle]);

  const flyMapToSearchPlace = useCallback(
    (handle: MapViewHandle, lat: number, lng: number, radiusKm: number) => {
      if (!isValidLatLng(lat, lng)) return;
      const flyDurationSec = 1.2;
      if (mapStyle === 'globe') {
        handle.prepareFlatAt(lat, lng, undefined, radiusKm);
        setMapStyle('flat');
        localStorage.setItem(MAP_STYLE_KEY, 'flat');
        window.setTimeout(() => {
          const active = mapViewRef.current;
          if (active?.isMapReady()) {
            active.invalidateSize();
            active.flyToCityBounds(lat, lng, radiusKm, { durationSec: flyDurationSec });
          }
        }, 400);
      } else {
        handle.invalidateSize();
        handle.flyToCityBounds(lat, lng, radiusKm, { durationSec: flyDurationSec });
        window.setTimeout(() => mapViewRef.current?.invalidateSize(), 80);
      }
    },
    [mapStyle]
  );

  const runMapSearchFly = useCallback(
    (intent: MapSearchSearchIntent) => {
      if (intent.nonce <= lastHandledMapSearchFlyNonceRef.current) return;
      const { latitude, longitude, location, kind = 'city' } = intent;
      if (!isValidLatLng(latitude, longitude)) return;

      mapSearchFlyCancelRef.current?.();
      mapExploredRef.current = true;
      programmaticMapMoveUntilRef.current = Date.now() + 2500;
      const radiusKm = getMapSearchFlyRadiusKm(location, kind);
      const placeLabel =
        extractCityFromLocation(location).label || location.split('(')[0]?.trim() || location;

      mapSearchFlyCancelRef.current = scheduleMapFlyWhenReady(
        () => mapViewRef.current,
        (handle) => {
          flyMapToSearchPlace(handle, latitude, longitude, radiusKm);
          setToastMsg(t('map.searchFlyTo', { place: placeLabel }));
          lastHandledMapSearchFlyNonceRef.current = intent.nonce;
          mapSearchFlyCancelRef.current = null;
        }
      );
    },
    [flyMapToSearchPlace, t]
  );

  const tryRunPendingMapSearchFly = useCallback(() => {
    if (!isActive) return;
    const intent = takePendingMapFlyToPlace();
    if (!intent) return;
    runMapSearchFly(intent);
  }, [isActive, runMapSearchFly]);

  useEffect(() => {
    const onFlyRequest = () => {
      tryRunPendingMapSearchFly();
    };
    window.addEventListener(MAP_FLY_TO_PLACE_EVENT, onFlyRequest);
    return () => window.removeEventListener(MAP_FLY_TO_PLACE_EVENT, onFlyRequest);
  }, [tryRunPendingMapSearchFly]);

  useEffect(() => {
    tryRunPendingMapSearchFly();
  }, [tryRunPendingMapSearchFly]);

  useEffect(
    () => () => {
      mapSearchFlyCancelRef.current?.();
      mapAnchorFlyCancelRef.current?.();
      mapRecenterFlyCancelRef.current?.();
    },
    []
  );

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

  const flyToGeoPointsBounds = useCallback((points: { latitude: number; longitude: number }[]) => {
    const valid = points.filter((p) => isValidLatLng(p.latitude, p.longitude));
    if (valid.length === 0) return;

    if (valid.length === 1) {
      mapViewRef.current?.flyToCityBounds(valid[0].latitude, valid[0].longitude, 5);
      return;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of valid) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    let maxDistKm = 0;
    for (const p of valid) {
      const d = getDistanceKm(centerLat, centerLng, p.latitude, p.longitude);
      if (d > maxDistKm) maxDistKm = d;
    }
    mapViewRef.current?.flyToCityBounds(centerLat, centerLng, Math.max(maxDistKm * 1.4, 10));
  }, []);

  const flyToEventMarkersBounds = useCallback((markers: MapEventMarker[]) => {
    flyToGeoPointsBounds(markers);
  }, [flyToGeoPointsBounds]);

  const applyEventFilter = useCallback(
    (criteria: MapEventFilterCriteria) => {
      deactivateMapContentFiltersExcept('events');
      setEventFilterCustomized(true);
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
    if (!hadMarkers) setLoadingMapEvents(true);

    loadMapEventMarkers(token, {
      signal: { cancelled },
      onProgress: (partial) => {
        if (cancelled || partial.length === 0) return;
        setMapEvents(partial);
        setLoadingMapEvents(false);
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
  }, [isActive, token, mapEventsRefreshKey, user?.id, flyToEventMarkersBounds]);

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
      setTimeout(doSelect, MAP_GLOBE_FLAT_DO_SELECT_MS);
    },
    []
  );

  const handleAutoSwitchToGlobe = useCallback(() => {
    if (!canUseGlobeView()) return;
    setMapStyle('globe');
    localStorage.setItem(MAP_STYLE_KEY, 'globe');
  }, []);

  const handleMapZoomSliderChange = useCallback((norm: number) => {
    mapViewRef.current?.setZoomControlNorm(norm);
  }, []);

  const handleMapZoomSliderDragStart = useCallback(() => {
    mapViewRef.current?.setZoomSliderDragging(true);
  }, []);

  const handleMapZoomSliderDragEnd = useCallback(() => {
    mapViewRef.current?.setZoomSliderDragging(false);
  }, []);

  const handleMapSearchSelectPlace = useCallback(
    (hit: PlaceSearchHit) => {
      noteMapExplored();
      if (mapStyle === 'globe') {
        const altitude = hit.kind === 'country' ? 1.8 : 0.45;
        mapViewRef.current?.flyToGlobe(hit.latitude, hit.longitude, altitude);
        return;
      }
      const radiusKm = getMapSearchFlyRadiusKm(hit.label, hit.kind === 'country' ? 'country' : 'city');
      const handle = mapViewRef.current;
      if (handle?.isMapReady()) {
        handle.invalidateSize();
        handle.flyToCityBounds(hit.latitude, hit.longitude, radiusKm, { durationSec: 1.2 });
      }
    },
    [mapStyle, noteMapExplored]
  );

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
    setLives(r.lives.filter(isActiveMapLive));
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

  // Sans ce cleanup, un timer en attente au démontage de HomePage (changement
  // d'onglet) déclenche loadNearbyAt/setState après que le composant ait
  // quitté l'arbre React.
  useEffect(() => {
    return () => {
      if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    };
  }, []);

  useHomeGeoRefresh({
    isActive,
    token,
    geoBootstrapReady: !authBootPending,
    profileCity: user?.city,
    center,
    defaultCenter: DEFAULT_CENTER,
    loadNearbyAt,
    loadNearbyFromState,
    setSafeCenter,
    setUserPosition,
    applyMapViewportCenter,
    mapExploredRef,
    geoIntervalRef,
  });

  useEffect(() => {
    if (!isActive) return;
    const onMapGeo = () => {
      mapExploredRef.current = false;
      const geo = getLivesGeo();
      if (isFixedMapGeoSource(geo.source)) {
        const coords: [number, number] = [geo.latitude, geo.longitude];
        applyMapViewportCenter(coords);
        setUserPosition(null);
        loadNearby(geo.latitude, geo.longitude);
        return;
      }
      if (!navigator.geolocation) {
        const fallback = resolveMapCameraFallbackCenter(user?.city);
        applyMapViewportCenter(fallback);
        loadNearby(fallback[0], fallback[1]);
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1]));
          applyMapViewportCenter(coords);
          loadNearby(coords[0], coords[1]);
          setLocating(false);
        },
        () => {
          setLocating(false);
          const fallback = resolveMapCameraFallbackCenter(user?.city);
          applyMapViewportCenter(fallback);
          loadNearby(fallback[0], fallback[1]);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      );
    };
    window.addEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
  }, [isActive, token, user?.city, applyMapViewportCenter]);

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

    const applyRecenter = (coords: [number, number]) => {
      const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
      setUserPosition(safe);
      loadNearbyAt(safe);
      flyMapRecenter(safe);
      return safe;
    };

    if (isFixedMapGeoSource(geo.source)) {
      applyRecenter([geo.latitude, geo.longitude]);
      return;
    }

    const fallbackCoords = userPosition ?? resolveMapCameraFallbackCenter(user?.city);

    if (!navigator.geolocation) {
      applyRecenter(fallbackCoords);
      return;
    }

    // Vol immédiat (position connue ou fallback ville), puis affinage GPS si disponible.
    applyRecenter(fallbackCoords);

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
        setLocating(false);
        if (
          userPosition &&
          getDistanceKm(userPosition[0], userPosition[1], safe[0], safe[1]) < 0.05
        ) {
          // GPS inchangé — forcer quand même le cadrage (pan/zoom utilisateur).
          flyMapRecenter(safe);
          return;
        }
        applyRecenter(safe);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  }, [userPosition, user?.city, loadNearbyAt, setUserPosition, flyMapRecenter]);

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
    if (isValidLatLng(cluster.latitude, cluster.longitude)) {
      mapViewRef.current?.flyTo(cluster.latitude, cluster.longitude, 15);
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

  const flyToMapEventMarker = useCallback(
    (event: MapEventMarker, opts?: { radiusKm?: number }) => {
      const radiusKm = opts?.radiusKm ?? MAP_EVENT_DETAIL_FLY_RADIUS_KM;
      const flyToEventCoords = (lat: number, lng: number) => {
        if (!isValidLatLng(lat, lng)) return;
        programmaticMapMoveUntilRef.current = Date.now() + 2500;
        mapExploredRef.current = true;
        scheduleMapFlyWhenReady(() => mapViewRef.current, (handle) => {
          flyMapToSearchPlace(handle, lat, lng, radiusKm);
        });
        setCenter((prev) => {
          const safe = sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER);
          if (getDistanceKm(prev[0], prev[1], safe[0], safe[1]) < 0.01) return prev;
          return safe;
        });
      };

      if (isValidLatLng(event.latitude, event.longitude)) {
        flyToEventCoords(event.latitude, event.longitude);
        return;
      }
      const location = event.eventLocation?.trim() ?? '';
      const syncCoords = location ? resolveEventCoordsSync(location) : null;
      if (syncCoords) flyToEventCoords(syncCoords.latitude, syncCoords.longitude);
    },
    [flyMapToSearchPlace]
  );

  const handleCityEventClick = useCallback(
    (event: MapEventMarker) => {
      const post = feedPostFromMapEventMarker(
        event,
        mapEventPostsRef.current.get(event.id),
        savedEventPostIds
      );
      mapEventPostsRef.current.set(event.id, post);
      setMapEventPostVersion((v) => v + 1);
      setMapSearchEventModal(null);
      setSelectedMapEvent(null);
      setMapSearchOrganizerModal(null);
      setHighlightedMapEventId(event.id);
      setMapFocusedEvent(event);
      flyToMapEventMarker(event, { radiusKm: MAP_SIDEBAR_EVENT_FLY_RADIUS_KM });
      if (eventsFilterOn) {
        setNearbyPeopleVisible(true);
      }
    },
    [eventsFilterOn, savedEventPostIds, setNearbyPeopleVisible, flyToMapEventMarker]
  );

  /** Sidebar MapEventRow / liste cluster — zoom + surbrillance, sans modal. */
  const handleSidebarMapEventZoom = useCallback(
    (event: MapEventMarker) => {
      const post = feedPostFromMapEventMarker(
        event,
        mapEventPostsRef.current.get(event.id),
        savedEventPostIds
      );
      mapEventPostsRef.current.set(event.id, post);
      setMapEventPostVersion((v) => v + 1);
      setMapSearchEventModal(null);
      setSelectedMapEvent(null);
      setMapSearchOrganizerModal(null);
      setHighlightedMapEventId(event.id);
      setMapFocusedEvent(null);
      setNearbyPeopleVisible(true);
      flyToMapEventMarker(event, { radiusKm: MAP_SIDEBAR_EVENT_FLY_RADIUS_KM });
    },
    [savedEventPostIds, setNearbyPeopleVisible, flyToMapEventMarker]
  );

  const handleBrowseEventDetailOpen = useCallback(
    (post: FeedPost) => {
      const saved = applySavedEventFavoriteState(post, savedEventPostIds);
      mapEventPostsRef.current.set(saved.id, saved);
      setMapEventPostVersion((v) => v + 1);
      let opened = false;
      const openMarker = (marker: MapEventMarker) => {
        if (opened) return;
        opened = true;
        handleCityEventClick(marker);
      };
      void buildMapEventMarkersFromPosts([saved], {
        onProgress: (markers) => {
          if (markers[0]) openMarker(markers[0]);
        },
      }).then((markers) => {
        if (markers[0]) {
          openMarker(markers[0]);
          return;
        }
        const location = saved.eventLocation?.trim() ?? '';
        const coords = location ? resolveEventCoordsSync(location) : null;
        if (coords) {
          openMarker({
            id: saved.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            title: saved.content.trim() || 'Événement',
            eventDate: saved.eventDate ?? saved.eventDates?.[0],
            eventDates: saved.eventDates,
            eventEndTimes: saved.eventEndTimes,
            eventLocation: saved.eventLocation,
            eventType: saved.eventType,
            authorId: saved.author.id,
            authorUsername: saved.author.username,
            authorAvatarUrl: saved.author.avatarUrl,
            authorUsernameColor: saved.author.usernameColor,
            authorUsernameWaveFrom: saved.author.usernameWaveFrom,
            authorUsernameWaveTo: saved.author.usernameWaveTo,
            ...(saved.eventTaggedUsers?.length ? { eventTaggedUsers: saved.eventTaggedUsers } : {}),
          });
        }
      });
    },
    [savedEventPostIds, handleCityEventClick]
  );

  const handleBrowseLivesViewOnMap = useCallback(() => {
    flyToGeoPointsBounds(collectGeoPointsFromLivesContent(mapSidebarContent));
  }, [flyToGeoPointsBounds, mapSidebarContent]);

  const handleBrowseSalonViewOnMap = useCallback(() => {
    flyToGeoPointsBounds(collectGeoPointsFromSalonContent(mapSidebarContent));
  }, [flyToGeoPointsBounds, mapSidebarContent]);

  const handleBrowseViewOnMap = useCallback(
    (posts: FeedPost[]) => {
      setShowEventsBrowseSheet(false);
      void buildMapEventMarkersFromPosts(posts).then((markers) => {
        if (markers.length > 0) flyToEventMarkersBounds(markers);
      });
    },
    [flyToEventMarkersBounds]
  );

  const focusMapOnFeedEvent = useCallback(
    (post: FeedPost, opts?: { openModal?: boolean; radiusKm?: number }) => {
      const saved = applySavedEventFavoriteState(post, savedEventPostIds);
      mapEventPostsRef.current.set(saved.id, saved);
      setMapEventPostVersion((v) => v + 1);
      const flyRadiusKm = opts?.radiusKm ?? MAP_EVENT_DETAIL_FLY_RADIUS_KM;

      const flewRef = { current: false };
      const flyToEventCoords = (lat: number, lng: number) => {
        if (flewRef.current || !isValidLatLng(lat, lng)) return;
        flewRef.current = true;
        programmaticMapMoveUntilRef.current = Date.now() + 2500;
        mapExploredRef.current = true;
        scheduleMapFlyWhenReady(() => mapViewRef.current, (handle) => {
          flyMapToSearchPlace(handle, lat, lng, flyRadiusKm);
        });
        setCenter((prev) => {
          const safe = sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER);
          if (getDistanceKm(prev[0], prev[1], safe[0], safe[1]) < 0.01) return prev;
          return safe;
        });
      };

      const location = saved.eventLocation?.trim() ?? '';
      const syncCoords = location ? resolveEventCoordsSync(location) : null;
      if (syncCoords) {
        flyToEventCoords(syncCoords.latitude, syncCoords.longitude);
      }

      void buildMapEventMarkersFromPosts([saved]).then((markers) => {
        const marker = markers[0];
        if (!marker) return;
        if (!flewRef.current) {
          flyToEventCoords(marker.latitude, marker.longitude);
        }
        if (opts?.openModal) {
          setMapFocusedEvent(null);
          setSelectedMapEvent(marker);
        }
      });
    },
    [savedEventPostIds, flyMapToSearchPlace]
  );

  const handleBrowseEventZoomOnMap = useCallback(
    (post: FeedPost) => {
      setMapSearchEventModal(null);
      setSelectedMapEvent(null);
      setMapSearchOrganizerModal(null);
      setHighlightedMapEventId(post.id);
      setMapFocusedEvent(null);
      setNearbyPeopleVisible(true);
      focusMapOnFeedEvent(post, { radiusKm: MAP_SIDEBAR_EVENT_FLY_RADIUS_KM });
    },
    [focusMapOnFeedEvent, setNearbyPeopleVisible]
  );

  const handleBrowseEventOpen = useCallback(
    (post: FeedPost) => {
      setNearbyPeopleVisible(true);
      focusMapOnFeedEvent(post, { openModal: true });
    },
    [focusMapOnFeedEvent, setNearbyPeopleVisible]
  );

  const openMapSearchEventPopup = useCallback(
    (marker: MapEventMarker, post: FeedPost | null) => {
      const saved = post ? applySavedEventFavoriteState(post, savedEventPostIds) : null;
      if (saved) {
        mapEventPostsRef.current.set(saved.id, saved);
        setMapEventPostVersion((v) => v + 1);
      }
      setMapSearchOrganizerModal(null);
      setMapFocusedEvent(null);
      setMapSearchEventModal({ marker, post: saved });
      setSelectedMapEvent(marker);

      const flyToEventCoords = (lat: number, lng: number) => {
        if (!isValidLatLng(lat, lng)) return;
        programmaticMapMoveUntilRef.current = Date.now() + 2500;
        mapExploredRef.current = true;
        scheduleMapFlyWhenReady(() => mapViewRef.current, (handle) => {
          flyMapToSearchPlace(handle, lat, lng, MAP_EVENT_DETAIL_FLY_RADIUS_KM);
        });
        setCenter((prev) => {
          const safe = sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER);
          if (getDistanceKm(prev[0], prev[1], safe[0], safe[1]) < 0.01) return prev;
          return safe;
        });
      };

      if (isValidLatLng(marker.latitude, marker.longitude)) {
        flyToEventCoords(marker.latitude, marker.longitude);
        return;
      }

      const location = marker.eventLocation?.trim() ?? saved?.eventLocation?.trim() ?? '';
      const syncCoords = location ? resolveEventCoordsSync(location) : null;
      if (syncCoords) {
        flyToEventCoords(syncCoords.latitude, syncCoords.longitude);
      }
    },
    [savedEventPostIds, flyMapToSearchPlace]
  );

  const handleMapSearchSelectEvent = useCallback(
    (hit: MapEventSearchEventHit) => {
      openMapSearchEventPopup(hit.marker, hit.post);
    },
    [openMapSearchEventPopup]
  );

  const handleMapSearchSelectOrganizer = useCallback((hit: MapEventSearchOrganizerHit) => {
    setMapSearchEventModal(null);
    setMapSearchOrganizerModal(hit);
  }, []);

  const handleMapSearchOrganizerPickEvent = useCallback(
    (post: FeedPost) => {
      const saved = applySavedEventFavoriteState(post, savedEventPostIds);
      mapEventPostsRef.current.set(saved.id, saved);
      setMapEventPostVersion((v) => v + 1);
      setMapSearchOrganizerModal(null);
      void buildMapEventMarkersFromPosts([saved]).then((markers) => {
        const marker = markers[0];
        if (marker) openMapSearchEventPopup(marker, saved);
      });
    },
    [savedEventPostIds, openMapSearchEventPopup]
  );

  const handleBrowseEventPostChange = useCallback((postId: string, patch: Partial<FeedPost>) => {
    let cached = mapEventPostsRef.current.get(postId);
    if (!cached) {
      const marker = mapEventsRef.current.find((e) => e.id === postId);
      if (marker) {
        cached = feedPostFromMapEventMarker(marker, null, savedEventPostIds);
      }
    }
    if (cached) {
      mapEventPostsRef.current.set(postId, { ...cached, ...patch });
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
  }, [savedEventPostIds]);

  const mapEventsBrowseConfig = useMemo((): MapSidebarEventsBrowseConfig | undefined => {
    if (!token || !sidebarEventsFilterOn) return undefined;
    return {
      token,
      profileCity: user?.city,
      favoriteAuthorIds: favoriteIds,
      eventsFilterOn,
      filterCriteria: eventFilterCriteria,
      eventFilterCustomized,
      aroundEventPosts: browseAroundEventPosts,
      viewerId: user?.id,
      onZoomEventOnMap: handleBrowseEventZoomOnMap,
      onOpenEvent: handleBrowseEventOpen,
      onOpenEventDetail: handleBrowseEventDetailOpen,
      onOpenInFeed: onOpenFeedPost,
      onPostChange: handleBrowseEventPostChange,
      selectedMapEventDayKey: mapEventDayPinFilter,
      onMapEventDayKeySelect: handleMapEventDayPinFilter,
    };
  }, [
    token,
    sidebarEventsFilterOn,
    eventsFilterOn,
    user?.city,
    user?.id,
    favoriteIds,
    eventFilterCriteria,
    eventFilterCustomized,
    browseAroundEventPosts,
    handleBrowseEventZoomOnMap,
    handleBrowseEventOpen,
    handleBrowseEventDetailOpen,
    onOpenFeedPost,
    handleBrowseEventPostChange,
    mapEventDayPinFilter,
    handleMapEventDayPinFilter,
  ]);

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
        ensureYoutubeLinkedToJoinSalon(user?.connectedPlatforms, isHost, salon.platform);
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
    setSelectedMajorCityCluster(null);
    setSelectedEventCluster(null);
    flyMapTo(cluster.latitude, cluster.longitude);
  }, [flyMapTo]);

  const handleMapMajorCityClusterClick = useCallback((cluster: MapMajorCityLiveCluster) => {
    setSelectedMajorCityCluster(cluster);
    setSelectedLiveCluster(null);
    setSelectedEventCluster(null);
    flyMapTo(cluster.latitude, cluster.longitude);
  }, [flyMapTo]);

  const handleMapBackgroundClick = useCallback(() => {
    if (selectedEventCluster) setSelectedEventCluster(null);
    if (selectedLiveCluster) setSelectedLiveCluster(null);
    if (selectedMajorCityCluster) setSelectedMajorCityCluster(null);
    if (highlightedMapEventId) setHighlightedMapEventId(null);
    if (mapFocusedEvent) setMapFocusedEvent(null);
    if (mapProfileOpen) onCloseMapProfile?.();
  }, [
    mapProfileOpen,
    onCloseMapProfile,
    selectedEventCluster,
    selectedLiveCluster,
    selectedMajorCityCluster,
    highlightedMapEventId,
    mapFocusedEvent,
  ]);

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

  const publishMapEvent = useCallback(
    async (draft: FeedEventDraft) => {
      if (!token || eventPublishing) return;
      setEventPublishing(true);
      try {
        const eventTypeLabel =
          draft.eventType === 'dance'
            ? t('feed.eventTypeDance')
            : draft.eventType === 'chant'
              ? t('feed.eventTypeChant')
              : t('feed.eventTypeAutre');
        const textContent = buildFeedEventContent(draft.title, draft.description, eventTypeLabel);
        const eventDatesIso = draft.confirmedEventDates.map((e) => new Date(e.start).toISOString());
        const body: Parameters<typeof api.createFeedPost>[1] = {
          content: textContent,
          isEvent: true,
          eventDates: eventDatesIso,
          eventDate: eventDatesIso[0],
          eventLocation: draft.eventLocation.trim(),
          eventType: draft.eventType,
        };
        const img = draft.imageUrl.trim();
        if (img) body.imageUrl = img;
        const linkRaw = draft.eventLinkUrl.trim();
        if (linkRaw) {
          const validated = validateStoryLinkUrl(linkRaw);
          if (!validated.ok) {
            setToastMsg(validated.error);
            return;
          }
          body.eventLinkUrl = validated.url;
        }
        const endTimesIso = draft.confirmedEventDates.map((e) =>
          e.end ? new Date(e.end).toISOString() : null
        );
        if (endTimesIso.some(Boolean)) body.eventEndTimes = endTimesIso;
        if (draft.eventTaggedUsers.length > 0) {
          body.eventTaggedUserIds = draft.eventTaggedUsers.map((u) => u.id);
        }
        await api.createFeedPost(token, body);
        if (draft.saveEventLocation && draft.eventLocation.trim()) {
          writeSavedEventLocation(draft.eventLocation);
        }
        setEventModalOpen(false);
        dispatchMapEventsRefresh();
        setToastMsg(t('map.createEventSuccess', { defaultValue: 'Événement publié sur la carte' }));
        const coords = await resolveEventCoords(draft.eventLocation.trim());
        if (coords) {
          mapViewRef.current?.jumpTo(coords.latitude, coords.longitude, 14);
          setMapStyle('flat');
          localStorage.setItem(MAP_STYLE_KEY, 'flat');
          setMapViewportCenter(sanitizeLatLngTuple(coords.latitude, coords.longitude, DEFAULT_CENTER));
        }
      } catch (e) {
        setToastMsg(
          e instanceof Error
            ? e.message
            : t('map.createEventError', { defaultValue: 'Publication impossible.' })
        );
      } finally {
        setEventPublishing(false);
      }
    },
    [token, eventPublishing, t]
  );

  const openExistingHostedSalon = useCallback(
    (salonId: string) => {
      setShowCreateSalon(false);
      onOpenSalon?.(salonId, user?.salonTitle, true);
    },
    [onOpenSalon, user?.salonTitle]
  );

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

  /** Retire un salon terminé de la carte sans attendre l'expiration du cache nearby. */
  useEffect(() => {
    if (!isActive || !token) return;
    const socket = getSocket();
    if (!socket) return;

    const onSalonEnded = (payload: { salonId?: string }) => {
      const endedId = payload?.salonId;
      if (!endedId) return;
      clearNearbyCache();
      setSalons((prev) => prev.filter((s) => s.id !== endedId));
      setLives((prev) => prev.filter((l) => l.id !== endedId && l.salonId !== endedId));
      setSelected((prev) => (prev?.id === endedId ? null : prev));
      loadNearbyAt(nearbyFetchCenterRef.current, { updateUserGeo: false, silent: true });
    };

    socket.on('salon_ended', onSalonEnded);
    return () => {
      socket.off('salon_ended', onSalonEnded);
    };
  }, [isActive, token, loadNearbyAt]);

  /** Retire un live terminé de la carte sans attendre l'expiration du cache nearby. */
  useEffect(() => {
    if (!isActive || !token) return;
    const socket = getSocket();
    if (!socket) return;

    const onLiveEnded = (payload: { liveId?: string; hostId?: string }) => {
      const endedId = payload?.liveId;
      if (!endedId) return;
      const hostId = payload?.hostId;
      clearNearbyCache();
      setLives((prev) => purgeEndedLiveFromMapState(endedId, hostId, [], prev, []).lives);
      setSalons((prev) => purgeEndedLiveFromMapState(endedId, hostId, prev, [], []).salons);
      setNearbyPeople((prev) => purgeEndedLiveFromMapState(endedId, hostId, [], [], prev).people);
      setSelected((prev) =>
        prev &&
        (prev.id === endedId || (hostId != null && prev.hostId === hostId && prev.isLive))
          ? null
          : prev
      );
      setSelectedLiveCluster((cluster) => {
        if (!cluster) return null;
        const hit =
          cluster.lives.some((l) => l.id === endedId) ||
          cluster.salons.some((s) => s.id === endedId || (hostId != null && s.hostId === hostId));
        return hit ? null : cluster;
      });
      loadNearbyAt(nearbyFetchCenterRef.current, { updateUserGeo: false, silent: true });
    };

    socket.on('live_ended', onLiveEnded);
    return () => {
      socket.off('live_ended', onLiveEnded);
    };
  }, [isActive, token, loadNearbyAt]);

  /** Secours si live_ended socket manqué (ex. hôte revenu carte après stop) — refreshUser a cleared isLive. */
  const prevUserLiveRef = useRef<{ isLive?: boolean; liveId?: string }>({});
  useEffect(() => {
    const prev = prevUserLiveRef.current;
    const next = { isLive: user?.isLive, liveId: user?.liveId };
    prevUserLiveRef.current = next;
    if (!isActive || !token) return;
    if (!prev.isLive || !prev.liveId) return;
    if (next.isLive && next.liveId) return;

    const endedId = prev.liveId;
    const hostId = user?.id;
    clearNearbyCache();
    setLives((p) => purgeEndedLiveFromMapState(endedId, hostId, [], p, []).lives);
    setSalons((p) => purgeEndedLiveFromMapState(endedId, hostId, p, [], []).salons);
    setNearbyPeople((p) => purgeEndedLiveFromMapState(endedId, hostId, [], [], p).people);
    setSelected((sel) =>
      sel && (sel.id === endedId || (hostId && sel.hostId === hostId && sel.isLive)) ? null : sel
    );
    loadNearbyAt(nearbyFetchCenterRef.current, { updateUserGeo: false, silent: true });
  }, [isActive, token, user?.isLive, user?.liveId, user?.id, loadNearbyAt]);

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
        !ensureYoutubeLinkedToJoinSalon(user.connectedPlatforms, isHost, salonForGate.platform)
      ) {
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

      {token && eventsFilterOn && (
        <MapEventsBrowseSheet
          open={showEventsBrowseSheet}
          onClose={() => setShowEventsBrowseSheet(false)}
          token={token}
          profileCity={user?.city}
          favoriteAuthorIds={favoriteIds}
          eventsFilterOn={eventsFilterOn}
          filterCriteria={eventFilterCriteria}
          eventFilterCustomized={eventFilterCustomized}
          aroundEventPosts={browseAroundEventPosts}
          viewerId={user?.id}
          onApplyFilter={applyEventFilter}
          onPreviewFilterCity={previewEventFilterCity}
          onViewOnMap={handleBrowseViewOnMap}
          onOpenEvent={handleBrowseEventOpen}
          onOpenEventDetail={handleBrowseEventDetailOpen}
          onOpenInFeed={onOpenFeedPost}
          onPostChange={handleBrowseEventPostChange}
          selectedMapEventDayKey={mapEventDayPinFilter}
          onMapEventDayKeySelect={handleMapEventDayPinFilter}
          sponsoredEventPosts={sidebarSponsoredEvents.posts}
        />
      )}

      {livesFilterOn && (
        <MapSidebarBrowseSheet
          mode="lives"
          open={showLivesBrowseSheet}
          onClose={() => setShowLivesBrowseSheet(false)}
          content={mapSidebarContent}
          itemCount={uniqueLiveCountFromContent(mapSidebarContent)}
          profileCity={user?.city}
          userPosition={userPosition}
          onViewOnMap={handleBrowseLivesViewOnMap}
          onLiveClick={handleSidebarLiveClick}
        />
      )}

      {salonFilterOn && (
        <MapSidebarBrowseSheet
          mode="salon"
          open={showSalonBrowseSheet}
          onClose={() => setShowSalonBrowseSheet(false)}
          content={mapSidebarContent}
          itemCount={uniqueSalonCountFromContent(mapSidebarContent)}
          selectedSalonId={selected?.id}
          onOpenFilter={openSalonFilterSheet}
          onViewOnMap={handleBrowseSalonViewOnMap}
          onSalonClick={handleSidebarSalonClick}
        />
      )}

      {token && (
        <MapCurrentFilterPopup
          open={mapFilterPopupOpen}
          onClose={() => setMapFilterPopupOpen(false)}
          activeFilter={activeMapFilterKind}
          itemCount={activeMapFilterCount}
          eventCriteria={eventFilterCriteria}
          salonCriteria={salonFilterCriteria}
          onEditSalon={openSalonFilterSheet}
          onEditEvents={openEventFilterSheet}
          onDisableLives={() => {
            setNearbyPanelPreferences({ livesOnly: false });
            setShowLivesBrowseSheet(false);
          }}
          onDisableSalon={disableSalonFilter}
          onDisableEvents={disableEventsFilter}
          onActivateLives={() => {
            deactivateMapContentFiltersExcept('lives');
            setNearbyPanelPreferences({ livesOnly: true });
          }}
          onActivateSalon={openSalonFilterSheet}
          onActivateEvents={() => {
            deactivateMapContentFiltersExcept('events');
            setShowEventMarkers(true);
            setNearbyPeopleVisible(true);
          }}
        />
      )}

      {token && (
        <MapSalonFilterSheet
          open={showSalonFilterSheet}
          initialCriteria={salonFilterCriteria}
          profileCity={user?.city}
          profileGenres={user?.favoriteGenres}
          activeSalons={salons}
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
          profileGenres={user.favoriteGenres}
          activeSalonId={user.salonId ?? null}
          hostIsLive={Boolean(user.isLive && user.liveId)}
          open={showCreateSalon}
          fallbackLatitude={nearbyQueryCenter[0]}
          fallbackLongitude={nearbyQueryCenter[1]}
          profileCity={user.city}
          onClose={() => setShowCreateSalon(false)}
          onCreated={onSalonCreated}
          onOpenExistingSalon={openExistingHostedSalon}
          onUserUpdated={setUserFromProfile}
          onDeferredError={setToastMsg}
        />
      )}

      {token && user && (
        <CreateFeedEventModal
          open={eventModalOpen}
          onClose={() => {
            if (!eventPublishing) setEventModalOpen(false);
          }}
          onConfirm={(draft) => {
            void publishMapEvent(draft);
          }}
          token={token}
          profileCity={user.city}
        />
      )}

      {token && user && <StartLiveFlowModals flow={liveStartFlow} />}

      {!bottomMapList && showNearbyPeople ? (
        selectedEventCluster && !livesFilterOn ? (
          <MapCityEventsPanel
            layout="side"
            cluster={selectedEventClusterForPanel ?? selectedEventCluster}
            detailTier={mapDetailState.tier}
            favoriteIds={favoriteIds}
            onEventClick={handleSidebarMapEventZoom}
            onBack={clearEventClusterSelection}
            onHide={() => setNearbyPeopleVisible(false)}
          />
        ) : (
          <NearbyPeoplePanel
            layout="side"
            content={mapSidebarContent}
            detail={mapDetailState}
            loading={loadingNearby}
            eventsLoading={loadingMapEvents}
            selectedSalonId={selected?.id}
            onPersonClick={handleSidebarPersonClick}
            onSalonClick={handleSidebarSalonClick}
            onLiveClick={handleSidebarLiveClick}
            onEventClick={handleSidebarMapEventZoom}
            onHide={() => setNearbyPeopleVisible(false)}
            eventsFilterOn={sidebarEventsFilterOn}
            livesFilterOn={sidebarLivesFilterOn}
            salonFilterOn={salonFilterOn}
            eventsBrowseMode={sidebarEventsFilterOn}
            eventsBrowse={mapEventsBrowseConfig}
            sponsoredEventPosts={sidebarSponsoredEvents.posts}
            onSponsoredEventOpen={handleBrowseEventZoomOnMap}
            onSponsoredEventPostChange={sidebarSponsoredEvents.patchPost}
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
        {!appa2 && !mapProfileOpen && !(selected?.platform === 'youtube') && (
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
        {selectedMajorCityCluster && (
          <MapMajorCityLiveSheet
            cluster={selectedMajorCityCluster}
            onClose={() => setSelectedMajorCityCluster(null)}
            onLiveClick={(live) => {
              setSelectedMajorCityCluster(null);
              handleMapLiveClick(live);
            }}
            onSalonClick={(salon) => {
              setSelectedMajorCityCluster(null);
              handleMapSalonClick(salon);
            }}
          />
        )}
        <div className="absolute inset-0 z-0">
        <MapView
          ref={mapViewRef}
          salons={mapSalonsForView}
          lives={mapLivesForView}
          people={mapPeopleForView}
          eventClusters={mapEventClustersForMap}
          hasEventClusters={mapEventClustersForMap.length > 0}
          eventsOnly={mapEventsOnly}
          showAllSalonsAtCityZoom={showAllSalonsAtCityZoom}
          center={center}
          recenterToken={mapRecenterToken}
          userPosition={mapUserDisplay?.coords}
          userPositionKind={mapUserDisplay?.kind}
          onSelectSalon={handleMapSalonClick}
          onSelectLive={handleMapLiveClick}
          onSelectPerson={handleMapPersonClick}
          onSelectEventCluster={handleMapEventClusterClick}
          onSelectMapEvent={handleCityEventClick}
          onSelectLiveCluster={handleMapLiveClusterClick}
          onSelectMajorCityCluster={handleMapMajorCityClusterClick}
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
          onZoomControlChange={setMapZoomControl}
          livesFilterOn={livesFilterOn}
          salonFilterOn={salonFilterOn}
          eventsFilterOn={eventsFilterOn}
          highlightedMapEventId={highlightedMapEventId}
          eventBrowseDayKeys={mapEventBrowseDayKeys}
          eventBrowsePinFallbackNearest={mapEventBrowsePinFallbackNearest}
        />
        </div>
        {mapStyle === 'globe' && (
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,15,0.65) 100%)' }}
          />
        )}

        {mapFocusedEvent && !mapSearchEventModal && !mapProfileOpen && (
          <MapEventMapInfoPanel
            marker={mapFocusedEvent}
            post={mapFocusedEventPost}
            savedEventPostIds={savedEventPostIds}
            onClose={() => {
              setMapFocusedEvent(null);
              setHighlightedMapEventId(null);
            }}
            onOpenDetail={() => {
              setSelectedMapEvent(mapFocusedEvent);
              setMapFocusedEvent(null);
            }}
            onPostUpdated={handleBrowseEventPostChange}
            onOpenAuthor={(userId) => {
              const cached = mapEventPostsRef.current.get(mapFocusedEvent.id);
              onOpenProfile({
                id: userId,
                username: cached?.author.username ?? mapFocusedEvent.authorUsername ?? '',
                avatarUrl: cached?.author.avatarUrl ?? mapFocusedEvent.authorAvatarUrl,
                usernameColor: cached?.author.usernameColor ?? mapFocusedEvent.authorUsernameColor,
                usernameWaveFrom: cached?.author.usernameWaveFrom ?? mapFocusedEvent.authorUsernameWaveFrom,
                usernameWaveTo: cached?.author.usernameWaveTo ?? mapFocusedEvent.authorUsernameWaveTo,
              });
              setMapFocusedEvent(null);
              setHighlightedMapEventId(null);
            }}
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
              className={`${MAP_CREATE_FAB_BTN} disabled:opacity-50 inline-flex items-center gap-1.5`}
            >
              {liveStartFlow.starting ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 animate-spin shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>{t('map.startingLive', { defaultValue: 'Démarrage…' })}</span>
                </>
              ) : (
                <span className={USERNAME_WAVE_CLASS}>+ Lives</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEventModalOpen(true)}
              disabled={eventPublishing}
              aria-label={t('map.createEventFabAria', { defaultValue: 'Créer un événement' })}
              className={`${MAP_CREATE_FAB_BTN} disabled:opacity-50`}
            >
              <span className={USERNAME_WAVE_CLASS}>+ Event</span>
            </button>
            <button
              aria-label={t('home.createSalon', { defaultValue: 'Créer un salon musical' })}
              className={MAP_CREATE_FAB_BTN}
            >
              <span className={USERNAME_WAVE_CLASS}>+ Salon</span>
            </button>
          </div>
        )}

        {!mapProfileOpen && (
          <MapZoomSlider
            value={mapZoomControl.norm}
            mode={mapZoomControl.mode}
            onChange={handleMapZoomSliderChange}
            onInteractionStart={handleMapZoomSliderDragStart}
            onInteractionEnd={handleMapZoomSliderDragEnd}
            className="absolute right-3 top-1/2 -translate-y-[calc(50%+1.75rem)] z-30"
          />
        )}

        {!mapProfileOpen && (
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
                <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.25" fill="currentColor" fillOpacity="0.92" />
                  <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
                  <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        )}

        {token && !mapProfileOpen && (
          <MapEventSearchBar
            markers={mapEventsIncludingSponso}
            postsById={mapEventPostsMap}
            onSelectEvent={handleMapSearchSelectEvent}
            onSelectOrganizer={handleMapSearchSelectOrganizer}
            onSelectPlace={handleMapSearchSelectPlace}
          />
        )}

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
                title={t('map.eventsBrowseOpenTitle', {
                  defaultValue: 'Voir les événements autour et dans votre pays',
                })}
                aria-label={t('map.eventsBrowseOpenTitle', {
                  defaultValue: 'Voir les événements autour et dans votre pays',
                })}
                aria-pressed={showEventMarkers}
                className={`${MAP_STACK_FILTER_BTN} ${
                  showEventMarkers
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                    : 'bg-[#12121a] border-[#2d2d3d] hover:border-purple-500/60 text-white/70 hover:text-purple-200'
                }`}
              >
                {loadingMapEvents && mapEvents.length === 0 ? (
                  <span className="h-2.5 w-2.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                ) : (
                  <span aria-hidden className="shrink-0 flex h-2.5 w-2.5 items-center justify-center text-[10px] leading-none">
                    📅
                  </span>
                )}
                Évènement
              </button>
            </div>
          )}
          <div className="ms-map-globe-row flex items-center gap-1.5 w-full shrink-0">
            <button
              type="button"
              onClick={openMapFilterPopup}
              title={mapBrowsePopupTitle}
              aria-label={mapBrowsePopupTitle}
              aria-expanded={anyBrowseSheetOpen}
              aria-pressed={anyMapFilterActive}
              className={`${MAP_STACK_ICON_BTN} relative ${
                anyMapFilterActive
                  ? 'border-indigo-500 bg-[var(--ms-surface)] text-indigo-300 ring-2 ring-indigo-500/40'
                  : 'border-[#232330] bg-[#131318] text-gray-400 hover:border-white/15 hover:text-white'
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
            </button>
            {canUseGlobeView() && (
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
            selectedEventCluster && !livesFilterOn ? (
              <MapCityEventsPanel
                layout={nearbyLayout}
                cluster={selectedEventClusterForPanel ?? selectedEventCluster}
                detailTier={mapDetailState.tier}
                favoriteIds={favoriteIds}
                onEventClick={handleSidebarMapEventZoom}
                onBack={clearEventClusterSelection}
                onHide={() => setNearbyPeopleVisible(false)}
              />
            ) : (
              <NearbyPeoplePanel
                layout={nearbyLayout}
                content={mapSidebarContent}
                detail={mapDetailState}
                loading={loadingNearby}
                eventsLoading={loadingMapEvents}
                selectedSalonId={selected?.id}
                onPersonClick={handleSidebarPersonClick}
                onSalonClick={handleSidebarSalonClick}
                onLiveClick={handleSidebarLiveClick}
                onEventClick={handleSidebarMapEventZoom}
                onHide={() => setNearbyPeopleVisible(false)}
                eventsFilterOn={sidebarEventsFilterOn}
                livesFilterOn={sidebarLivesFilterOn}
                salonFilterOn={salonFilterOn}
                eventsBrowseMode={sidebarEventsFilterOn}
                eventsBrowse={mapEventsBrowseConfig}
                sponsoredEventPosts={sidebarSponsoredEvents.posts}
                onSponsoredEventOpen={handleBrowseEventZoomOnMap}
                onSponsoredEventPostChange={sidebarSponsoredEvents.patchPost}
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
        open={!!mapSearchEventModal}
        marker={mapSearchEventModal?.marker ?? null}
        post={mapSearchEventPost}
        savedEventPostIds={savedEventPostIds}
        onClose={() => setMapSearchEventModal(null)}
        onPostUpdated={(postId, patch) => {
          const cached = mapEventPostsRef.current.get(postId);
          const marker = mapSearchEventModal?.marker;
          const next = cached
            ? { ...cached, ...patch }
            : marker?.id === postId
              ? ({
                  ...feedPostFromMapEventMarker(marker, null, savedEventPostIds),
                  ...patch,
                } as FeedPost)
              : null;
          if (next) {
            mapEventPostsRef.current.set(postId, next);
            setMapEventPostVersion((v) => v + 1);
          }
          if (patch.favoriteByMe !== undefined) {
            setSavedEventPostIds((prev) => {
              const nextIds = new Set(prev);
              if (patch.favoriteByMe) nextIds.add(postId);
              else nextIds.delete(postId);
              return nextIds;
            });
          }
        }}
        onOpenAuthor={(userId) => {
          const marker = mapSearchEventModal?.marker;
          if (!marker) return;
          const cached = mapEventPostsRef.current.get(marker.id);
          onOpenProfile({
            id: userId,
            username: cached?.author.username ?? marker.authorUsername ?? '',
            avatarUrl: cached?.author.avatarUrl ?? marker.authorAvatarUrl,
            usernameColor: cached?.author.usernameColor ?? marker.authorUsernameColor,
            usernameWaveFrom: cached?.author.usernameWaveFrom ?? marker.authorUsernameWaveFrom,
            usernameWaveTo: cached?.author.usernameWaveTo ?? marker.authorUsernameWaveTo,
          });
          setMapSearchEventModal(null);
        }}
      />

      <MapOrganizerEventsPopup
        open={!!mapSearchOrganizerModal}
        authorUsername={mapSearchOrganizerModal?.authorUsername ?? ''}
        authorId={mapSearchOrganizerModal?.authorId ?? ''}
        events={mapSearchOrganizerModal?.events ?? []}
        onClose={() => setMapSearchOrganizerModal(null)}
        onSelectEvent={handleMapSearchOrganizerPickEvent}
        onOpenAuthor={(userId) => {
          onOpenProfile({ id: userId, username: mapSearchOrganizerModal?.authorUsername ?? '' });
          setMapSearchOrganizerModal(null);
        }}
      />

      <MapEventDetailModal
        open={!!selectedMapEvent && !mapSearchEventModal}
        marker={selectedMapEvent}
        post={selectedMapEventPost}
        savedEventPostIds={savedEventPostIds}
        onClose={() => setSelectedMapEvent(null)}
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
