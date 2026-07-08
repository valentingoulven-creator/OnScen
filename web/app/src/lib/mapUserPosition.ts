import { useEffect, useMemo, useState } from 'react';
import { normalizeCityLabel } from './eventLocationPresets';
import { resolveEventCityCoordsSync, resolveEventCoords } from './mapEventCoords';
import { isValidLatLng, sanitizeLatLngTuple } from './mapCoords';
import {
  coordsForCityName,
  DEFAULT_CENTER,
  getLivesGeo,
  isFixedMapGeoSource,
  PRESET_CITIES,
  haversineKm,
} from './livesGeo';
import { getPrivacyPreferences, SETTINGS_CHANGED_EVENT } from './settings';

/** Centre caméra carte sans GPS : geo fixe (settings), ville profil, sinon Paris. */
export function resolveMapCameraFallbackCenter(profileCity?: string): [number, number] {
  const geo = getLivesGeo();
  if (isFixedMapGeoSource(geo.source)) {
    return sanitizeLatLngTuple(geo.latitude, geo.longitude, DEFAULT_CENTER);
  }
  const profile = resolveProfileCityCoordsSync(profileCity);
  if (profile) {
    return sanitizeLatLngTuple(profile[0], profile[1], DEFAULT_CENTER);
  }
  return [...DEFAULT_CENTER];
}

/** Coords synchrones pour la ville profil (lookup local, sans réseau). */
export function resolveProfileCityCoordsSync(profileCity?: string): [number, number] | null {
  const label = normalizeCityLabel(profileCity ?? '').trim();
  if (!label) return null;

  const fromLookup = resolveEventCityCoordsSync(label);
  if (fromLookup && isValidLatLng(fromLookup.latitude, fromLookup.longitude)) {
    return [fromLookup.latitude, fromLookup.longitude];
  }

  const preset = coordsForCityName(label);
  const matchedPreset = PRESET_CITIES.find(
    (c) =>
      c.label.toLowerCase() === label.toLowerCase() ||
      c.label.split(',')[0].trim().toLowerCase() === label.split(',')[0].trim().toLowerCase()
  );
  if (
    matchedPreset &&
    isValidLatLng(preset.latitude, preset.longitude) &&
    haversineKm(preset.latitude, preset.longitude, matchedPreset.latitude, matchedPreset.longitude) < 1
  ) {
    return [preset.latitude, preset.longitude];
  }

  return null;
}

/**
 * Point « ma position » sur la carte :
 * GPS si partage de position activé, sinon centre de la ville profil.
 * Masqué en mode fantôme.
 */
export function useMapUserDisplayPosition(
  userPosition: [number, number] | null,
  profileCity: string | undefined,
  isGhostMode: boolean | undefined
): [number, number] | null {
  const [privacyRev, setPrivacyRev] = useState(0);
  const [profileCoords, setProfileCoords] = useState<[number, number] | null>(() =>
    resolveProfileCityCoordsSync(profileCity)
  );

  useEffect(() => {
    const onSettings = () => setPrivacyRev((n) => n + 1);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettings);
  }, []);

  useEffect(() => {
    const sync = resolveProfileCityCoordsSync(profileCity);
    if (sync) {
      setProfileCoords(sync);
      return;
    }
    const label = normalizeCityLabel(profileCity ?? '').trim();
    if (!label) {
      setProfileCoords(null);
      return;
    }
    let cancelled = false;
    void resolveEventCoords(label).then((coords) => {
      if (cancelled || !coords) return;
      if (!isValidLatLng(coords.latitude, coords.longitude)) return;
      setProfileCoords([coords.latitude, coords.longitude]);
    });
    return () => {
      cancelled = true;
    };
  }, [profileCity]);

  return useMemo(() => {
    if (isGhostMode) return null;
    const { locationSharing } = getPrivacyPreferences();
    if (
      locationSharing &&
      userPosition &&
      isValidLatLng(userPosition[0], userPosition[1])
    ) {
      return sanitizeLatLngTuple(userPosition[0], userPosition[1]);
    }
    if (profileCoords && isValidLatLng(profileCoords[0], profileCoords[1])) {
      return profileCoords;
    }
    return null;
  }, [isGhostMode, userPosition, profileCoords, privacyRev]);
}
