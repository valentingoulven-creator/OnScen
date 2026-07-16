import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { normalizeCityLabel } from '../lib/eventLocationPresets';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { DEFAULT_CENTER, getLivesGeo, isFixedMapGeoSource } from '../lib/livesGeo';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import { getDistanceKm } from '../lib/mapMarkerVisibility';
import { resolveMapCameraFallbackCenter } from '../lib/mapUserPosition';
import { getPrivacyPreferences } from '../lib/settings';
import { getCurrentGeoPosition, isGeolocationAvailable } from '../lib/geoPosition';

export const HOME_GEO_REFRESH_INTERVAL_MS = 30_000;
export const HOME_GEO_REFRESH_BACKGROUND_MS = 60_000;
/** Ignore GPS jitter smaller than ~8 m when moving the user marker. */
const HOME_GEO_MIN_MOVE_KM = 0.008;

type Coords = [number, number];

function geoRefreshIntervalMs(): number {
  return typeof document !== 'undefined' && document.hidden
    ? HOME_GEO_REFRESH_BACKGROUND_MS
    : HOME_GEO_REFRESH_INTERVAL_MS;
}

export function useHomeGeoRefresh(options: {
  isActive: boolean;
  token: string | null;
  /** Attendre la fin du boot auth pour avoir user.city avant le fallback Paris. */
  geoBootstrapReady?: boolean;
  profileCity?: string;
  center: Coords;
  defaultCenter: Coords;
  loadNearbyAt: (coords: Coords, opts?: { updateUserGeo?: boolean }) => void;
  loadNearbyFromState: (userPos: Coords | null, mapCenter: Coords) => void;
  setSafeCenter: (coords: Coords) => void;
  setUserPosition: (pos: Coords | null) => void;
  /** True après pan/zoom carte ou rotation globe — ne pas recentrer sur GPS tardif. */
  mapExploredRef: RefObject<boolean>;
  geoIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
}): void {
  const {
    isActive,
    token,
    geoBootstrapReady = true,
    profileCity,
    center,
    defaultCenter,
    loadNearbyAt,
    loadNearbyFromState,
    setSafeCenter,
    setUserPosition,
    mapExploredRef,
    geoIntervalRef,
  } = options;

  const loadNearbyAtRef = useRef(loadNearbyAt);
  loadNearbyAtRef.current = loadNearbyAt;
  const loadNearbyFromStateRef = useRef(loadNearbyFromState);
  loadNearbyFromStateRef.current = loadNearbyFromState;
  const centerRef = useRef(center);
  centerRef.current = center;
  const setUserPositionRef = useRef(setUserPosition);
  setUserPositionRef.current = setUserPosition;
  const defaultCenterRef = useRef(defaultCenter);
  defaultCenterRef.current = defaultCenter;
  const lastUserGeoRef = useRef<Coords | null>(null);

  const profileCityRef = useRef(profileCity);
  profileCityRef.current = profileCity;

  /** Bootstrap GPS / ville profil — une seule fois à l'activation, pas à chaque pan/zoom carte. */
  useEffect(() => {
    if (!isActive || !token || !geoBootstrapReady) return;

    let cancelled = false;
    const geo = getLivesGeo();
    const { locationSharing } = getPrivacyPreferences();

    const applyProfileCityFallback = () => {
      const fallback = resolveMapCameraFallbackCenter(profileCityRef.current);
      if (!mapExploredRef.current) {
        setSafeCenter(fallback);
      }
      loadNearbyAt(fallback);

      const label = normalizeCityLabel(profileCityRef.current ?? '').trim();
      const isDefaultParis =
        fallback[0] === DEFAULT_CENTER[0] && fallback[1] === DEFAULT_CENTER[1];
      if (!label || !isDefaultParis) return;

      void resolveEventCoords(label).then((coords) => {
        if (cancelled || !coords || mapExploredRef.current) return;
        if (!isValidLatLng(coords.latitude, coords.longitude)) return;
        const resolved: Coords = sanitizeLatLngTuple(
          coords.latitude,
          coords.longitude,
          defaultCenter
        );
        if (!mapExploredRef.current) {
          setSafeCenter(resolved);
        }
        loadNearbyAtRef.current(resolved);
      });
    };

    if (isFixedMapGeoSource(geo.source)) {
      const coords: Coords = [geo.latitude, geo.longitude];
      setSafeCenter(coords);
      loadNearbyAt(coords);
    } else if (!isGeolocationAvailable()) {
      applyProfileCityFallback();
    } else {
      getCurrentGeoPosition().then(
        (pos) => {
          if (cancelled) return;
          const coords: Coords = [pos.latitude, pos.longitude];
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1], defaultCenter));
          if (!mapExploredRef.current) {
            setSafeCenter(coords);
          }
          loadNearbyAt(coords, { updateUserGeo: locationSharing });
        },
        () => {
          if (cancelled) return;
          applyProfileCityFallback();
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    token,
    geoBootstrapReady,
    profileCity,
    defaultCenter,
    loadNearbyAt,
    setSafeCenter,
    setUserPosition,
  ]);

  useEffect(() => {
    if (!isActive || !token) return;

    const tickGeo = () => {
      const current = getLivesGeo();
      const { locationSharing: sharing } = getPrivacyPreferences();
      if (isFixedMapGeoSource(current.source)) {
        loadNearbyAtRef.current([current.latitude, current.longitude]);
        return;
      }
      if (!isGeolocationAvailable()) {
        loadNearbyAtRef.current([current.latitude, current.longitude], { updateUserGeo: false });
        return;
      }
      getCurrentGeoPosition().then(
        (pos) => {
          const coords: Coords = [pos.latitude, pos.longitude];
          const sanitized = sanitizeLatLngTuple(coords[0], coords[1], defaultCenterRef.current);
          const prev = lastUserGeoRef.current;
          if (
            !prev ||
            getDistanceKm(prev[0], prev[1], sanitized[0], sanitized[1]) >= HOME_GEO_MIN_MOVE_KM
          ) {
            lastUserGeoRef.current = sanitized;
            setUserPositionRef.current(sanitized);
          }
          loadNearbyAtRef.current(coords, { updateUserGeo: sharing });
        },
        () => loadNearbyAtRef.current([current.latitude, current.longitude], { updateUserGeo: false })
      );
    };

    const restartGeoInterval = () => {
      if (geoIntervalRef.current) {
        clearInterval(geoIntervalRef.current);
        geoIntervalRef.current = null;
      }
      geoIntervalRef.current = setInterval(tickGeo, geoRefreshIntervalMs());
    };

    restartGeoInterval();

    const handleBeforeUnload = () => {
      if (geoIntervalRef.current) {
        clearInterval(geoIntervalRef.current);
        geoIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      restartGeoInterval();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (geoIntervalRef.current) {
        clearInterval(geoIntervalRef.current);
        geoIntervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, token, geoIntervalRef]);
}
