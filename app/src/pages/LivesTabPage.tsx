import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  getLivesGeo,
  setLivesGeo,
  PRESET_CITIES,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { FollowUserButton } from '../components/FollowUserButton';
import type { Live } from '../types';

interface LivesTabPageProps {
  isActive?: boolean;
  onOpenLive: (liveId: string) => void;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function LivesTabPage({ isActive = true, onOpenLive }: LivesTabPageProps) {
  const { token, user } = useAuth();
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [geo, setGeo] = useState<LivesGeoPrefs>(getLivesGeo);
  const [citySearch, setCitySearch] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    api.getMyFollowing(token).then((r) => setFollowingIds(new Set(r.followingIds)));
  }, [token]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return PRESET_CITIES;
    return PRESET_CITIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [citySearch]);

  const persistGeo = useCallback((next: LivesGeoPrefs) => {
    setGeo(next);
    setLivesGeo(next);
  }, []);

  const loadLives = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getLives(token, {
        latitude: geo.latitude,
        longitude: geo.longitude,
        radiusKm: geo.radiusKm,
      })
      .then((r) => setLives(r.lives.filter((l) => l.isActive)))
      .finally(() => setLoading(false));
  }, [token, geo.latitude, geo.longitude, geo.radiusKm]);

  useEffect(() => {
    if (!isActive) return;
    loadLives();
    const interval = setInterval(loadLives, 8000);
    return () => clearInterval(interval);
  }, [loadLives, isActive]);

  const selectCity = (city: (typeof PRESET_CITIES)[number]) => {
    persistGeo({
      latitude: city.latitude,
      longitude: city.longitude,
      radiusKm: geo.radiusKm,
      label: city.label,
      source: 'city',
    });
    setShowCityPicker(false);
    setCitySearch('');
    setGeoError(null);
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non disponible');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persistGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radiusKm: geo.radiusKm,
          label: 'Ma position',
          source: 'my_position',
        });
        setLocating(false);
        setShowCityPicker(false);
      },
      () => {
        setLocating(false);
        setGeoError('Impossible d\'obtenir votre position');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const changeRadius = (radiusKm: number) => {
    persistGeo({ ...geo, radiusKm });
  };

  const startMyLive = async () => {
    if (!token) return;
    setStarting(true);
    try {
      const { live } = await api.startLive(token, `Live — ${user?.username}`, {
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      loadLives();
      onOpenLive(live.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f]">
      <div className="p-4 border-b border-[#1e1e2f] bg-gradient-to-b from-red-950/30 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Lives
          </h2>
          <button
            onClick={startMyLive}
            disabled={starting}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-full text-xs font-bold text-white disabled:opacity-50"
          >
            {starting ? '...' : 'Démarrer mon Live'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Sessions en direct avec chat rapide et réactions
        </p>

        <div className="space-y-3 rounded-xl bg-[#12121a] border border-[#1e1e2f] p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useMyPosition}
              disabled={locating}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30 disabled:opacity-50"
            >
              {locating ? 'Localisation…' : 'Ma position'}
            </button>
            <button
              type="button"
              onClick={() => setShowCityPicker((v) => !v)}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1a1a26] text-gray-200 border border-[#2a2a3f] hover:border-red-500/40 text-left truncate"
            >
              {geo.label}
            </button>
          </div>

          {geoError && <p className="text-[10px] text-red-400">{geoError}</p>}

          {showCityPicker && (
            <div className="space-y-2">
              <input
                type="search"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Rechercher une ville…"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-xs text-white placeholder:text-gray-500"
              />
              <ul className="max-h-36 overflow-y-auto space-y-1">
                {filteredCities.map((city) => (
                  <li key={city.id}>
                    <button
                      type="button"
                      onClick={() => selectCity(city)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-200 hover:bg-[#1a1a26]"
                    >
                      {city.label}
                    </button>
                  </li>
                ))}
                {filteredCities.length === 0 && (
                  <li className="px-3 py-2 text-xs text-gray-500">Aucune ville trouvée</li>
                )}
              </ul>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">Rayon de recherche</span>
              <span className="text-red-400 font-bold">{geo.radiusKm} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={geo.radiusKm}
              onChange={(e) => changeRadius(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
        </div>
      </div>

      {loading && (
        <p className="p-8 text-center text-gray-500 text-sm">Chargement des lives...</p>
      )}

      {!loading && lives.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-gray-400 text-sm">Aucun live en cours dans un rayon de {geo.radiusKm} km</p>
          <p className="text-gray-500 text-xs mt-2">
            Élargissez le rayon ou changez de ville pour découvrir d&apos;autres sessions
          </p>
        </div>
      )}

      <ul className="p-3 space-y-3">
        {lives.map((live) => (
          <li key={live.id}>
            <button
              onClick={() => onOpenLive(live.id)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#12121a] border border-[#1e1e2f] hover:border-red-500/50 text-left transition"
            >
              <div className="relative shrink-0">
                <img
                  src={live.playbackState.albumArtUrl || ''}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover"
                />
                <span className="absolute -bottom-1 -right-1 bg-red-600 text-[8px] font-bold px-1.5 py-0.5 rounded text-white">
                  LIVE
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{live.title}</p>
                <p className="text-xs text-gray-400 truncate">{live.hostName}</p>
                <p className="text-xs text-purple-400 truncate mt-0.5">
                  {live.playbackState.title} — {live.playbackState.artist}
                </p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                {live.hostId !== user?.id && (
                  <FollowUserButton
                    userId={live.hostId}
                    username={live.hostName}
                    initialFollowing={followingIds.has(live.hostId)}
                    compact
                    onFollowingChange={(f) =>
                      setFollowingIds((prev) => {
                        const next = new Set(prev);
                        if (f) next.add(live.hostId);
                        else next.delete(live.hostId);
                        return next;
                      })
                    }
                  />
                )}
                {live.distanceKm !== undefined && (
                  <p className="text-xs text-red-400 font-semibold">{formatDistance(live.distanceKm)}</p>
                )}
                <p className="text-xs text-gray-400">{live.viewersCount}</p>
                <p className="text-[10px] text-gray-500">spectateurs</p>
                <span className="text-[10px] uppercase text-gray-500">{live.platform}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
