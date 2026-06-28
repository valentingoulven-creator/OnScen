import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { getLivesGeo, isFixedMapGeoSource } from '../lib/livesGeo';
import { getPrivacyPreferences } from '../lib/settings';
import { sanitizeLatLngTuple } from '../lib/mapCoords';

export const HOME_GEO_REFRESH_INTERVAL_MS = 30_000;
export const HOME_GEO_REFRESH_BACKGROUND_MS = 60_000;

type Coords = [number, number];

function geoRefreshIntervalMs(): number {
  return typeof document !== 'undefined' && document.hidden
    ? HOME_GEO_REFRESH_BACKGROUND_MS
    : HOME_GEO_REFRESH_INTERVAL_MS;
}

export function useHomeGeoRefresh(options: {
  isActive: boolean;
  token: string | null;
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

  /** Bootstrap GPS / ville — une seule fois à l'activation, pas à chaque pan/zoom carte. */
  useEffect(() => {
    if (!isActive || !token) return;

    const geo = getLivesGeo();
    const { locationSharing } = getPrivacyPreferences();

    if (isFixedMapGeoSource(geo.source)) {
      const coords: Coords = [geo.latitude, geo.longitude];
      setSafeCenter(coords);
      loadNearbyAt(coords);
    } else if (!navigator.geolocation || !locationSharing) {
      loadNearbyFromStateRef.current(null, centerRef.current);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: Coords = [pos.coords.latitude, pos.coords.longitude];
          setUserPosition(sanitizeLatLngTuple(coords[0], coords[1], defaultCenter));
          if (!mapExploredRef.current) {
            setSafeCenter(coords);
          }
          loadNearbyAt(coords);
        },
        () => loadNearbyFromStateRef.current(null, centerRef.current)
      );
    }
  }, [
    isActive,
    token,
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
      if (!navigator.geolocation || !sharing) {
        loadNearbyAtRef.current([current.latitude, current.longitude], { updateUserGeo: false });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: Coords = [pos.coords.latitude, pos.coords.longitude];
          setUserPositionRef.current(sanitizeLatLngTuple(coords[0], coords[1], defaultCenterRef.current));
          loadNearbyAtRef.current(coords);
        },
        () => loadNearbyAtRef.current([current.latitude, current.longitude])
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
