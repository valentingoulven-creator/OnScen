import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket, onSocketConnect } from '../lib/socket';
import { MapView } from '../components/MapView';
import { MapStoriesAccordion } from '../components/MapStoriesAccordion';
import { NearbyPeoplePanel } from '../components/NearbyPeoplePanel';
import { MapSalonListenSheet } from '../components/MapSalonListenSheet';
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
  NEARBY_PANEL_CHANGED_EVENT,
  peopleMarkersOnMap,
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
}

export function HomePage({
  appLayout = 'default',
  onOpenSalon,
  onOpenLive,
  onOpenLiveTab,
  onOpenProfile,
  onOpenReel,
  mapProfileOpen = false,
  hideStartLiveMapButton = false,
  onCloseMapProfile,
  mapPlaybackActive = true,
}: HomePageProps) {
  const appa2 = isAppa2Layout(appLayout);
  const nearbyLayout = appa2 ? ('bottom' as const) : ('side' as const);
  const { user, token, setUserFromProfile } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<NearbyPerson[]>([]);
  const [selected, setSelected] = useState<Salon | null>(null);
  const [center, setCenter] = useState<[number, number]>(() => [...DEFAULT_CENTER]);
  const setSafeCenter = (coords: [number, number]) => {
    if (!isValidLatLng(coords[0], coords[1])) {
      setCenter([...DEFAULT_CENTER]);
      return;
    }
    setCenter(sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER));
  };
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [showNearbyPeople, setShowNearbyPeople] = useState(
    () => localStorage.getItem(NEARBY_PEOPLE_STORAGE_KEY) !== 'false'
  );
  const [nearbyPanelPrefs, setNearbyPanelPrefs] = useState(getNearbyPanelPreferences);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const salonSheetRef = useRef<HTMLDivElement>(null);
  const [salonSheetHeightPx, setSalonSheetHeightPx] = useState(0);
  const [salonSheetExpanded, setSalonSheetExpanded] = useState(false);

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
      favoritesFirst: nearbyPanelPrefs.favoritesFirst,
      sortByMusicalAffinity: nearbyPanelPrefs.musicalAffinitiesOnly,
      viewerTastes,
    }),
    [favoriteIds, nearbyPanelPrefs.favoritesFirst, nearbyPanelPrefs.musicalAffinitiesOnly, viewerTastes]
  );

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
    nearbyPanelPrefs.platformFilter,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbyPanelPrefs.filterByDistance,
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
    nearbyPanelPrefs.platformFilter,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbyPanelPrefs.filterByDistance,
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
    nearbyPanelPrefs.platformFilter,
    nearbyPanelPrefs.livesOnly,
    nearbyPanelPrefs.sortBy,
    nearbyPanelPrefs.filterByDistance,
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

  const setNearbyPeopleVisible = (visible: boolean) => {
    setShowNearbyPeople(visible);
    localStorage.setItem(NEARBY_PEOPLE_STORAGE_KEY, visible ? 'true' : 'false');
  };

  const loadNearbyAt = (coords: [number, number]) => {
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
            distanceFilter: prefs.filterByDistance,
          })
          .then((r) => {
            setSalons(r.salons);
            setLives(r.lives);
            setNearbyPeople(r.people ?? []);
          })
          .finally(() => setLoadingNearby(false));
      });
  };

  const loadNearby = (lat: number, lon: number) => {
    loadNearbyAt(sanitizeLatLngTuple(lat, lon, DEFAULT_CENTER));
  };

  const loadNearbyFromState = (
    userPos: [number, number] | null,
    mapCenter: [number, number]
  ) => {
    loadNearbyAt(getNearbyQueryCenter(userPos, mapCenter));
  };

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
      loadNearbyFromState(userPosition, center);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, reloadFromPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, reloadFromPrefs);
    };
  }, [token, userPosition, center]);

  const recenterLabel = isFixedMapGeoSource(mapGeo.source)
    ? `Recentrer sur ${mapGeo.label}`
    : 'Recentrer sur ma position';

  const recenterMap = () => {
    const geo = getLivesGeo();

    if (isFixedMapGeoSource(geo.source)) {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      setSafeCenter(coords);
      loadNearby(geo.latitude, geo.longitude);
      return;
    }

    const flyTo = (coords: [number, number]) => {
      const safe = sanitizeLatLngTuple(coords[0], coords[1], DEFAULT_CENTER);
      setSafeCenter(safe);
      setUserPosition(safe);
      loadNearbyAt(safe);
    };

    if (userPosition) {
      flyTo(userPosition);
      return;
    }

    if (!navigator.geolocation) {
      flyTo([geo.latitude, geo.longitude]);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyTo([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        flyTo([geo.latitude, geo.longitude]);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  };

  const focusPersonOnMap = (person: NearbyPerson) => {
    if (person.salonId) {
      const salon = salons.find((s) => s.id === person.salonId);
      if (salon && isValidLatLng(salon.latitude, salon.longitude)) {
        setSafeCenter([salon.latitude, salon.longitude]);
      }
    } else if (
      person.latitude != null &&
      person.longitude != null &&
      isValidLatLng(person.latitude, person.longitude)
    ) {
      setSafeCenter([person.latitude, person.longitude]);
    }
  };

  const dismissSalonSheetOnly = () => {
    setSelected(null);
    setSalonSheetExpanded(false);
    clearSalonUrlFromBar();
  };

  const openProfileFromNearby = (person: NearbyPerson) => {
    dismissSalonSheetOnly();
    focusPersonOnMap(person);
    onOpenProfile(person);
  };

  const selectSalonForPerson = async (person: NearbyPerson): Promise<boolean> => {
    if (!person.salonId) return false;

    let salon = salons.find((s) => s.id === person.salonId);
    if (!salon && token) {
      try {
        const { salon: fetched } = await api.getSalon(token, person.salonId);
        salon = fetched;
        setSalons((prev) => (prev.some((s) => s.id === fetched.id) ? prev : [...prev, fetched]));
      } catch {
        return false;
      }
    }
    if (!salon) return false;

    focusPersonOnMap(person);
    await trySelectSalon(salon, { closeMapProfile: true });
    setSalonSheetExpanded(false);
    return true;
  };

  const openNearbyPerson = async (person: NearbyPerson) => {
    if (person.isLive && person.liveId) {
      dismissSalonSheetOnly();
      onCloseMapProfile?.();
      onOpenLive(person.liveId);
      return;
    }
    if (person.salonId) {
      const joined = await selectSalonForPerson(person);
      if (!joined) openProfileFromNearby(person);
      return;
    }
    openProfileFromNearby(person);
  };

  const handleMapPersonClick = (person: NearbyPerson) => {
    void openNearbyPerson(person);
  };

  const handleMapSalonClick = (salon: Salon) => {
    if (salon.isLive) {
      dismissSalonSheetOnly();
      onCloseMapProfile?.();
      onOpenLive(salon.id);
      return;
    }
    void trySelectSalon(salon, { closeMapProfile: true });
  };

  const trySelectSalon = async (
    salon: Salon,
    opts?: { closeMapProfile?: boolean }
  ) => {
    if (salon.canJoin === false && salon.hostId !== user?.id) {
      alert('Salon sur invitation uniquement — le host doit vous autoriser');
      return;
    }
    if (token && salon.canJoin !== true && salon.hostId !== user?.id) {
      try {
        await api.joinSalon(token, salon.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Accès refusé');
        return;
      }
    }
    if (opts?.closeMapProfile) {
      onCloseMapProfile?.();
    }
    setSelected(salon);
    setSalonSheetExpanded(false);
  };

  const closeSalonSheet = () => {
    dismissSalonSheetOnly();
    onCloseMapProfile?.();
  };

  const onSalonCreated = (salon: Salon, lat: number, lon: number) => {
    setShowCreateSalon(false);
    setSalons((s) => [...s, salon]);
    setSelected(salon);
    setSalonSheetExpanded(true);
    setSafeCenter([lat, lon]);
    loadNearby(lat, lon);
  };

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
        alert('Accès refusé à ce salon');
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
      setSelected((prev) =>
        prev && prev.id === salonId
          ? { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) }
          : prev
      );
    };
    socket.on('salon_join_denied', onDenied);
    socket.on('salon_kicked', onKicked);
    socket.on('salon_banned', onBanned);
    socket.on('salon_updated', onSalonUpdated);
    socket.on('playback_sync', onPlaybackSync);
    socket.on('salon_playback', onPlaybackSync);
    return () => {
      offReconnect();
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

  useEffect(() => {
    const el = salonSheetRef.current;
    if (!selected || !el) {
      setSalonSheetHeightPx(0);
      return;
    }
    const measure = () => setSalonSheetHeightPx(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected]);

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
          onOpenProfile={(person) => void openNearbyPerson(person)}
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
        <MapView
          salons={mapSalons}
          lives={mapLives}
          people={mapPeople}
          center={center}
          userPosition={userPosition ?? undefined}
          onSelectSalon={(s) => handleMapSalonClick(s)}
          onSelectLive={(l) => onOpenLive(l.id)}
          onSelectPerson={handleMapPersonClick}
          onMapBackgroundClick={() => {
            if (mapProfileOpen) onCloseMapProfile?.();
          }}
        />

        {mapPlaybackActive && !mapProfileOpen && token && (
          <div className="absolute top-2 left-2 right-2 z-[35] pointer-events-none max-w-[calc(100%-1rem)]">
            <div className="pointer-events-auto">
              <MapStoriesAccordion
                isActive={mapPlaybackActive}
                nearbyPeople={filteredNearbyPeople}
                onOpenProfile={(person) => void openNearbyPerson(person)}
                onOpenReel={onOpenReel}
              />
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-3 z-30 flex flex-col items-center gap-2 pointer-events-auto">
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
              onOpenProfile={(person) => void openNearbyPerson(person)}
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
