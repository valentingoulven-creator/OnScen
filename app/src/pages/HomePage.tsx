import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket, onSocketConnect } from '../lib/socket';
import { MapView, type MapViewHandle, type MapStyle } from '../components/MapView';
import { NearbyPeoplePanel } from '../components/NearbyPeoplePanel';
import { MapSalonListenSheet } from '../components/MapSalonListenSheet';
import { MapLiveListenSheet } from '../components/MapLiveListenSheet';
import { CreateSalonModal } from '../components/CreateSalonModal';
import { MapAdBanner } from '../components/MapAdBanner';
import { StartLiveMapButton } from '../components/StartLiveMapButton';
import { MAP_OPEN_CREATE_SALON_EVENT } from '../lib/mapUiEvents';
import { isAppa2Layout, type AppLayoutId } from '../lib/appLayout';
import type { NearbyPerson, Salon, Live } from '../types';
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
import { clearSalonUrlFromBar } from '../lib/salonDeepLink';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import type { PlaybackState } from '../types';

const NEARBY_PEOPLE_STORAGE_KEY = 'melosong_show_nearby_people';
const MAP_STYLE_KEY = 'soundly_map_style';
const MAP_LIVE_ZOOM = 15;

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
  mapProfileOpen?: boolean;
  /** Masquer Démarrer LIVE (mon profil, paramètres, overlay profil carte = moi). */
  hideStartLiveMapButton?: boolean;
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
  mapProfileOpen = false,
  hideStartLiveMapButton = false,
  onCloseMapProfile,
  mapPlaybackActive = true,
  restoreSalonId,
  onSalonMapRestored,
}: HomePageProps) {
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
  const [salonSheetHeightPx, setSalonSheetHeightPx] = useState(0);
  const [salonSheetExpanded, setSalonSheetExpanded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  const mapMarkerCount = useMemo(() => {
    const salonIds = new Set(mapSalons.map((s) => s.id));
    const extraLives = mapLives.filter((l) => !salonIds.has(l.id)).length;
    return mapSalons.length + mapPeople.length + extraLives;
  }, [mapSalons, mapPeople, mapLives]);

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

  const handleGlobeZoomToFlat = useCallback(
    (lat: number, lng: number, doSelect: () => void, zoom?: number) => {
      // Repositionne instantanément la carte Leaflet (cachée) avant qu'elle soit visible
      mapViewRef.current?.jumpTo(lat, lng, zoom ?? 14);
      // Bascule vers la carte sombre
      setMapStyle('flat');
      localStorage.setItem(MAP_STYLE_KEY, 'flat');
      // Synchronise le centre React (le flyTo Leaflet sera un no-op car déjà positionné)
      setCenter(sanitizeLatLngTuple(lat, lng, DEFAULT_CENTER));
      // Ouvre le profil/salon/live avec un léger délai pour laisser la carte apparaître
      setTimeout(doSelect, 200);
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

  const loadNearbyAt = useCallback((coords: [number, number]) => {
    const [lat, lon] = coords;
    if (!token || !isValidLatLng(lat, lon)) return;
    const prefs = getNearbyPanelPreferences();
    const radius = getNearbyRadiusKm();
    setLoadingNearby(true);
    api
      .updateGeo(token, lat, lon)
      .catch(() => {})
      .finally(() => {
        api
          .nearby(token, lat, lon, {
            radiusKm: radius,
            distanceFilter: isNearbyDistanceFilterActive(prefs),
          })
          .then((r) => {
            setSalons(r.salons);
            setLives(r.lives);
            setNearbyPeople(r.people ?? []);
          })
          .finally(() => setLoadingNearby(false));
      });
  }, [token]);

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
    if (isFixedMapGeoSource(geo.source)) {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      setSafeCenter(coords);
      loadNearbyAt(coords);
    } else if (!navigator.geolocation) {
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

    // Unified 20s refresh: re-reads the current source on every tick so mode
    // switches (city ↔ GPS) are picked up without restarting the effect.
    const interval = setInterval(() => {
      const current = getLivesGeo();
      if (isFixedMapGeoSource(current.source)) {
        loadNearbyAt([current.latitude, current.longitude]);
        return;
      }
      if (!navigator.geolocation) {
        loadNearbyAt([current.latitude, current.longitude]);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => loadNearbyAt([pos.coords.latitude, pos.coords.longitude]),
        () => loadNearbyAt([current.latitude, current.longitude])
      );
    }, 20000);
    return () => clearInterval(interval);
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

  const recenterLabel = isFixedMapGeoSource(mapGeo.source)
    ? `Recentrer sur ${mapGeo.label}`
    : 'Recentrer sur ma position';

  const recenterMap = useCallback(() => {
    const geo = getLivesGeo();

    if (isFixedMapGeoSource(geo.source)) {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      mapViewRef.current?.flyTo(coords[0], coords[1], 13);
      setSafeCenter(coords);
      loadNearby(geo.latitude, geo.longitude);
      return;
    }

    const doRecenter = (coords: [number, number]) => {
      const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
      mapViewRef.current?.flyTo(safe[0], safe[1], 13);
      setSafeCenter(safe);
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
  }, [userPosition, loadNearby, loadNearbyAt, setSafeCenter]);

  const dismissSalonSheetOnly = useCallback(() => {
    setSelected(null);
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

  const trySelectSalon = useCallback(async (
    salon: Salon,
    opts?: { closeMapProfile?: boolean }
  ) => {
    if (salon.canJoin === false && salon.hostId !== user?.id) {
      setToastMsg('Salon sur invitation uniquement — le host doit vous autoriser');
      return;
    }
    if (token && salon.canJoin !== true && salon.hostId !== user?.id) {
      try {
        await api.joinSalon(token, salon.id);
      } catch (e) {
        setToastMsg(e instanceof Error ? e.message : 'Accès refusé');
        return;
      }
    }
    if (opts?.closeMapProfile) {
      onCloseMapProfile?.();
    }
    setSelected(salon);
    setSalonSheetExpanded(false);
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

  /** salonId sur la personne, sinon salon hôte déjà en cache carte. */
  const resolveSalonIdForPerson = useCallback((person: NearbyPerson): string | null => {
    if (person.salonId) return person.salonId;
    return salons.find((s) => s.hostId === person.id)?.id ?? null;
  }, [salons]);

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
    dismissLiveSheetOnly();
    await trySelectSalon(salon, { closeMapProfile: true });
    return true;
  }, [resolveSalonById, trySelectSalon, flyMapTo, dismissLiveSheetOnly]);

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
      onCloseMapProfile?.();

      let salon = findSalonForLive(live, salons);
      if (!salon && live.salonId) {
        salon = (await resolveSalonById(live.salonId)) ?? undefined;
      }
      if (salon) {
        dismissLiveSheetOnly();
        await trySelectSalon(salon, { closeMapProfile: true });
        return;
      }

      dismissSalonSheetOnly();
      setSelectedLive(live);
    })();
  }, [
    salons,
    resolveSalonById,
    trySelectSalon,
    flyMapTo,
    onCloseMapProfile,
    dismissSalonSheetOnly,
    dismissLiveSheetOnly,
  ]);

  /** Clic personne (carte ou liste) : live → salon lié → petit salon replié (jamais profil). */
  const openNearbyPerson = useCallback((person: NearbyPerson) => {
    void (async () => {
      if (person.isLive && person.liveId) {
        const live = await resolveLiveForPerson(person);
        if (live) {
          openLiveOnMap(live);
          return;
        }
      }

      const salonId = resolveSalonIdForPerson(person);
      if (salonId) {
        await openSalonOnMap(salonId);
      }
    })();
  }, [resolveLiveForPerson, resolveSalonIdForPerson, openLiveOnMap, openSalonOnMap]);

  const handleMapPersonClick = useCallback((person: NearbyPerson) => {
    openNearbyPerson(person);
  }, [openNearbyPerson]);

  const handleMapLiveClick = useCallback((l: Live) => {
    openLiveOnMap(l);
  }, [openLiveOnMap]);

  const handleMapBackgroundClick = useCallback(() => {
    if (mapProfileOpen) onCloseMapProfile?.();
  }, [mapProfileOpen, onCloseMapProfile]);

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

  useEffect(() => {
    const el = selected ? salonSheetRef.current : selectedLive ? liveSheetRef.current : null;
    if (!el) {
      setSalonSheetHeightPx(0);
      return;
    }
    const measure = () => setSalonSheetHeightPx(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected, selectedLive]);

  return (
    <div className={`relative flex-1 flex min-h-0 ${appa2 ? 'flex-col' : 'flex-row'}`}>
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
        <NearbyPeoplePanel
          layout="side"
          people={nearbyPeople}
          salons={salons}
          mapMarkerCount={mapMarkerCount}
          loading={loadingNearby}
          selectedSalonId={selected?.id}
          onPersonClick={openNearbyPerson}
          onHide={() => setNearbyPeopleVisible(false)}
          favoriteIds={favoriteIds}
        />
      ) : !appa2 ? (
        <button
          type="button"
          onClick={() => setNearbyPeopleVisible(true)}
          title="Afficher les personnes à proximité"
          aria-label="Afficher les personnes à proximité"
          className="shrink-0 z-20 flex flex-col items-center justify-center gap-1 w-10 sm:w-11 bg-[var(--ms-surface)]/95 border-r border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
          </svg>
          <span className="text-[8px] font-bold uppercase hidden sm:block">Liste</span>
          {!loadingNearby && filteredNearbyPeople.length > 0 && (
            <span className="text-[9px] font-bold bg-purple-600/80 text-white px-1.5 py-0.5 rounded-full min-w-[1.1rem]">
              {filteredNearbyPeople.length}
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
          salons={mapSalons}
          lives={mapLives}
          people={mapPeople}
          center={center}
          userPosition={userPosition ?? undefined}
          onSelectSalon={handleMapSalonClick}
          onSelectLive={handleMapLiveClick}
          onSelectPerson={handleMapPersonClick}
          onMapBackgroundClick={handleMapBackgroundClick}
          mapStyle={mapStyle}
          onGlobeZoomToFlat={handleGlobeZoomToFlat}
          onAutoSwitchToGlobe={handleAutoSwitchToGlobe}
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

        <div className="absolute bottom-4 right-3 z-30 flex flex-col items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setNearbyPanelPreferences({ livesOnly: !nearbyPanelPrefs.livesOnly })}
            title={nearbyPanelPrefs.livesOnly ? 'Voir tous les utilisateurs' : 'Lives uniquement'}
            aria-label={nearbyPanelPrefs.livesOnly ? 'Voir tous les utilisateurs' : 'Lives uniquement'}
            className={`px-3 py-2 rounded-full border shadow-lg active:scale-95 transition shrink-0 text-[10px] sm:text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 ${
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
          <button
            type="button"
            onClick={toggleMapStyle}
            title={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
            aria-label={mapStyle === 'flat' ? 'Vue globe satellite' : 'Vue carte sombre'}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#12121a] border shadow-lg active:scale-95 transition shrink-0 text-lg ${mapStyle === 'globe' ? 'border-indigo-500 text-indigo-300' : 'border-[#2d2d3d] hover:border-indigo-500/60 text-white/70 hover:text-white'}`}
          >
            {mapStyle === 'globe' ? '🗺️' : '🌐'}
          </button>
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

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateSalon(true);
            }}
            aria-label="Créer un salon musical"
            className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-full bg-[#12121a] border border-[#2d2d3d] hover:border-purple-500/60 font-extrabold text-xs sm:text-base shadow-lg shadow-black/30 whitespace-nowrap active:scale-95 transition"
          >
            <span className={USERNAME_WAVE_CLASS}>+ Salon</span>
          </button>
        </div>

        {token && user && !hideStartLiveMapButton && (
          <StartLiveMapButton
            token={token}
            username={user.username}
            userId={user.id}
            lives={lives}
            latitude={nearbyQueryCenter[0]}
            longitude={nearbyQueryCenter[1]}
            bottomSheetHeightPx={salonSheetHeightPx}
            onStarted={(liveId) => {
              loadNearbyFromState(userPosition, center);
              onOpenLive(liveId);
            }}
          />
        )}

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
              if (onOpenSalon) {
                onOpenSalon(selected.id);
                return;
              }
              setSalonSheetExpanded(true);
            }}
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
            <NearbyPeoplePanel
              layout={nearbyLayout}
              people={nearbyPeople}
              salons={salons}
              mapMarkerCount={mapMarkerCount}
              loading={loadingNearby}
              selectedSalonId={selected?.id}
              onPersonClick={openNearbyPerson}
              onHide={() => setNearbyPeopleVisible(false)}
              favoriteIds={favoriteIds}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNearbyPeopleVisible(true)}
              title="Afficher la liste à proximité"
              aria-label="Afficher la liste à proximité"
              className="shrink-0 z-20 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--ms-surface)]/95 border-t border-[var(--ms-border)] text-purple-400 hover:text-purple-300 hover:bg-[var(--ms-surface-elevated)] transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wide">Liste à proximité</span>
              {!loadingNearby && filteredNearbyPeople.length > 0 && (
                <span className="text-[10px] font-bold bg-purple-600/80 text-white px-2 py-0.5 rounded-full min-w-[1.25rem]">
                  {filteredNearbyPeople.length}
                </span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}
