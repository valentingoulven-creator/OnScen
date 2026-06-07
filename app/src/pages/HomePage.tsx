import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useViewport } from '../hooks/useViewport';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { MapView } from '../components/MapView';
import { ChatPanel } from '../components/ChatPanel';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { NearbyPeoplePanel } from '../components/NearbyPeoplePanel';
import { CreateSalonModal } from '../components/CreateSalonModal';
import { MapAdBanner } from '../components/MapAdBanner';
import { StartLiveMapButton } from '../components/StartLiveMapButton';
import { UserProfileSheet } from '../components/UserProfileSheet';
import type { NearbyPerson, Salon, Live } from '../types';
import { getNearbyRadiusKm, SETTINGS_CHANGED_EVENT } from '../lib/settings';
import { getLivesGeo, MAP_GEO_CHANGED_EVENT } from '../lib/livesGeo';
import {
  filterLivesForNearbyPanel,
  filterNearbyPeople,
  filterSalonsForNearbyPanel,
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  peopleMarkersOnMap,
} from '../lib/nearbyPanelSettings';

const NEARBY_PEOPLE_STORAGE_KEY = 'melosong_show_nearby_people';

interface HomePageProps {
  isActive?: boolean;
  onOpenSalon: (id: string) => void;
  onOpenLive: (liveId: string) => void;
  onOpenLiveTab?: () => void;
  onOpenReel?: (reelId: string) => void;
}

export function HomePage({ isActive = true, onOpenSalon, onOpenLive, onOpenLiveTab, onOpenReel }: HomePageProps) {
  const { user, token, setUserFromProfile } = useAuth();
  const { isMobile } = useViewport();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [nearbyPeople, setNearbyPeople] = useState<NearbyPerson[]>([]);
  const [selected, setSelected] = useState<Salon | null>(null);
  const [center, setCenter] = useState<[number, number]>([48.8566, 2.3522]);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [showNearbyPeople, setShowNearbyPeople] = useState(
    () => localStorage.getItem(NEARBY_PEOPLE_STORAGE_KEY) !== 'false'
  );
  const [profilePerson, setProfilePerson] = useState<NearbyPerson | null>(null);
  const [nearbyPanelPrefs, setNearbyPanelPrefs] = useState(getNearbyPanelPreferences);

  useEffect(() => {
    const syncPrefs = () => setNearbyPanelPrefs(getNearbyPanelPreferences());
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncPrefs);
    };
  }, []);

  const filteredNearbyPeople = useMemo(
    () => filterNearbyPeople(nearbyPeople, nearbyPanelPrefs),
    [nearbyPeople, nearbyPanelPrefs.platformFilter, nearbyPanelPrefs.livesOnly]
  );

  const mapPeople = useMemo(() => peopleMarkersOnMap(filteredNearbyPeople), [filteredNearbyPeople]);

  const mapSalons = useMemo(
    () => filterSalonsForNearbyPanel(salons, filteredNearbyPeople),
    [salons, filteredNearbyPeople]
  );

  const mapLives = useMemo(
    () => filterLivesForNearbyPanel(lives, filteredNearbyPeople),
    [lives, filteredNearbyPeople]
  );

  const setNearbyPeopleVisible = (visible: boolean) => {
    setShowNearbyPeople(visible);
    localStorage.setItem(NEARBY_PEOPLE_STORAGE_KEY, visible ? 'true' : 'false');
  };

  const loadNearby = (lat: number, lon: number) => {
    if (!token) return;
    const radius = getNearbyRadiusKm();
    setLoadingNearby(true);
    api
      .updateGeo(token, lat, lon)
      .catch(() => {})
      .finally(() => {
        api
          .nearby(token, lat, lon, radius)
          .then((r) => {
            setSalons(r.salons);
            setLives(r.lives);
            setNearbyPeople(r.people ?? []);
          })
          .finally(() => setLoadingNearby(false));
      });
  };

  useEffect(() => {
    if (!token || !isActive) return;

    const geo = getLivesGeo();
    if (geo.source === 'city') {
      const coords: [number, number] = [geo.latitude, geo.longitude];
      setCenter(coords);
      loadNearby(geo.latitude, geo.longitude);
      const interval = setInterval(() => {
        const current = getLivesGeo();
        if (current.source === 'city') {
          loadNearby(current.latitude, current.longitude);
        }
      }, 20000);
      return () => clearInterval(interval);
    }

    if (!navigator.geolocation) {
      loadNearby(center[0], center[1]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const coords: [number, number] = [lat, lon];
        setCenter(coords);
        setUserPosition(coords);
        loadNearby(lat, lon);
      },
      () => loadNearby(center[0], center[1])
    );
    const interval = setInterval(() => {
      if (getLivesGeo().source === 'city') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => loadNearby(pos.coords.latitude, pos.coords.longitude),
        () => loadNearby(center[0], center[1])
      );
    }, 20000);
    return () => clearInterval(interval);
  }, [token, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const onMapGeo = () => {
      const geo = getLivesGeo();
      if (geo.source === 'city') {
        setCenter([geo.latitude, geo.longitude]);
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
          setCenter(coords);
          setUserPosition(coords);
          loadNearby(coords[0], coords[1]);
          setLocating(false);
        },
        () => {
          setLocating(false);
          setCenter([geo.latitude, geo.longitude]);
          loadNearby(geo.latitude, geo.longitude);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      );
    };
    window.addEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, onMapGeo);
  }, [token, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const onSettings = () => {
      const geo = getLivesGeo();
      if (geo.source === 'city') {
        loadNearby(geo.latitude, geo.longitude);
      } else if (userPosition) {
        loadNearby(userPosition[0], userPosition[1]);
      } else {
        loadNearby(center[0], center[1]);
      }
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettings);
  }, [token, userPosition, center, isActive]);

  const recenterOnUser = () => {
    if (!navigator.geolocation) {
      alert('Géolocalisation non disponible sur cet appareil');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(coords);
        setUserPosition(coords);
        loadNearby(coords[0], coords[1]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Impossible d\'obtenir votre position. Vérifiez les permissions de localisation.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  };

  const handleSelectPerson = (person: NearbyPerson) => {
    if (person.salonId) {
      const salon = salons.find((s) => s.id === person.salonId);
      if (salon) {
        setSelected(salon);
        setCenter([salon.latitude, salon.longitude]);
      }
    }
  };

  const trySelectSalon = async (salon: Salon) => {
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
    setSelected(salon);
  };

  const onSalonCreated = (salon: Salon, lat: number, lon: number) => {
    setShowCreateSalon(false);
    setSalons((s) => [...s, salon]);
    setSelected(salon);
    setCenter([lat, lon]);
    loadNearby(lat, lon);
    onOpenSalon(salon.id);
  };

  useEffect(() => {
    if (!selected || !token || !user) return;
    if (selected.canJoin === false && selected.hostId !== user.id) return;
    const socket = getSocket();
    socket.emit('join_salon', { salonId: selected.id, userId: user.id, username: user.username });
    const onDenied = ({ salonId }: { salonId: string }) => {
      if (salonId === selected.id) {
        setSelected(null);
        alert('Accès refusé à ce salon');
      }
    };
    socket.on('salon_join_denied', onDenied);
    return () => {
      socket.emit('leave_salon', { salonId: selected.id });
      socket.off('salon_join_denied', onDenied);
    };
  }, [selected?.id, selected?.canJoin, user?.id, token]);

  return (
    <div className="relative flex-1 flex flex-row min-h-0">
      {token && user && (
        <CreateSalonModal
          token={token}
          username={user.username}
          connectedPlatforms={user.connectedPlatforms}
          open={showCreateSalon}
          fallbackLatitude={userPosition?.[0] ?? center[0]}
          fallbackLongitude={userPosition?.[1] ?? center[1]}
          onClose={() => setShowCreateSalon(false)}
          onCreated={onSalonCreated}
          onUserUpdated={setUserFromProfile}
        />
      )}
      {profilePerson && (
        <UserProfileSheet
          userId={profilePerson.id}
          preview={profilePerson}
          onClose={() => setProfilePerson(null)}
          onSelectSalon={(salonId) => {
            const salon = salons.find((s) => s.id === salonId);
            if (salon) {
              trySelectSalon(salon);
              setCenter([salon.latitude, salon.longitude]);
            }
          }}
          onOpenReel={onOpenReel}
        />
      )}
      {showNearbyPeople && isMobile && (
        <button
          type="button"
          className="mobile-sheet-backdrop md:hidden"
          onClick={() => setNearbyPeopleVisible(false)}
          aria-label="Fermer la liste des personnes proches"
        />
      )}
      {showNearbyPeople ? (
        <NearbyPeoplePanel
          className={isMobile ? 'mobile-sheet-panel' : undefined}
          people={nearbyPeople}
          loading={loadingNearby}
          selectedSalonId={selected?.id}
          onSelectPerson={handleSelectPerson}
          onOpenProfile={setProfilePerson}
          onHide={() => setNearbyPeopleVisible(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setNearbyPeopleVisible(true)}
          title="Afficher les personnes à proximité"
          aria-label="Afficher les personnes à proximité"
          className={`shrink-0 z-20 flex flex-col items-center justify-center gap-1 touch-target bg-[#12121a]/95 text-purple-400 hover:text-purple-300 hover:bg-[#1a1a26] transition ${
            isMobile
              ? 'absolute bottom-24 left-3 w-12 h-12 rounded-full border border-purple-500/40 shadow-lg'
              : 'w-11 border-r border-[#1e1e2f]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
          </svg>
          <span className={`text-[8px] font-bold uppercase ${isMobile ? 'sr-only' : 'hidden sm:block'}`}>Liste</span>
          {!loadingNearby && filteredNearbyPeople.length > 0 && (
            <span className="text-[9px] font-bold bg-purple-600/80 text-white px-1.5 py-0.5 rounded-full min-w-[1.1rem]">
              {filteredNearbyPeople.length}
            </span>
          )}
        </button>
      )}

      <div className="relative flex-1 min-w-0 flex flex-col min-h-0">
        <MapAdBanner
          onCtaSalon={() => setShowCreateSalon(true)}
          onCtaLive={onOpenLiveTab}
        />

        <div className="relative flex-1 min-h-0">
        <MapView
          salons={mapSalons}
          lives={mapLives}
          people={mapPeople}
          center={center}
          userPosition={userPosition ?? undefined}
          onSelectSalon={(s) => trySelectSalon(s)}
          onSelectLive={(l) => {
            const salon = salons.find((s) => s.id === l.id);
            if (salon) trySelectSalon(salon);
          }}
          onSelectPerson={setProfilePerson}
        />

        <div className="absolute bottom-4 right-3 z-30 flex flex-col items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={recenterOnUser}
            disabled={locating}
            title="Recentrer sur ma position"
            aria-label="Recentrer sur ma position"
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
            className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-full bg-purple-600 hover:bg-purple-500 font-bold text-white text-xs sm:text-base shadow-lg shadow-purple-900/50 whitespace-nowrap active:scale-95 transition"
          >
            + Salon
          </button>
        </div>

        {token && user && !profilePerson && (
          <StartLiveMapButton
            token={token}
            username={user.username}
            userId={user.id}
            lives={lives}
            latitude={userPosition?.[0] ?? center[0]}
            longitude={userPosition?.[1] ?? center[1]}
            mapBottomClass={selected ? 'bottom-[17.5rem] sm:bottom-[18rem]' : 'bottom-6'}
            onStarted={(liveId) => {
              loadNearby(userPosition?.[0] ?? center[0], userPosition?.[1] ?? center[1]);
              onOpenLive(liveId);
            }}
          />
        )}

        {selected && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#12121a]/95 border-t border-[#1e1e2f] backdrop-blur-md max-h-[55dvh] flex flex-col md:max-h-[45dvh]">
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => onOpenSalon(selected.id)}>
              <img
                src={selected.playbackState.albumArtUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{selected.playbackState.title}</p>
                <p className="text-xs text-gray-400">
                  {selected.hostName} · {selected.platform} · {selected.listenersCount} auditeurs
                  {selected.accessMode === 'invite' && ' · 🔒 Invité'}
                  {selected.accessMode === 'public' && ' · 🌍 Public'}
                </p>
              </div>
              {selected.isLive && (
                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full">LIVE</span>
              )}
              <span className="text-purple-400">▲</span>
            </div>
            <div
              className="px-3 py-2 border-b border-[#1e1e2f] bg-[#0b0b0f]/50"
              onClick={(e) => e.stopPropagation()}
            >
              <HostRatingBlock
                hostId={selected.hostId}
                hostName={selected.hostName}
                isBot={selected.isBot}
                salonId={selected.id}
                compact
              />
            </div>
            <div className="flex-1 min-h-[120px] max-h-[200px] border-t border-[#1e1e2f]">
              <ChatPanel
                roomId={selected.id}
                roomType="salon"
                userId={user!.id}
                userName={user!.username}
                token={token ?? undefined}
              />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
