import { geocodeQuery } from './geocodeAddress';

/** Lieux connus des seeds feed-event-* / user-event-* (coords venues). */
const VENUE_LOOKUP: Array<{ match: RegExp; latitude: number; longitude: number }> = [
  { match: /zénith sud|zenith sud/i, latitude: 43.5848, longitude: 3.8803 },
  { match: /bois de vincennes/i, latitude: 48.8298, longitude: 2.4328 },
  { match: /salle pleyel|pleyel/i, latitude: 48.8802, longitude: 2.3007 },
  { match: /accor arena|bercy/i, latitude: 48.8387, longitude: 2.3786 },
  { match: /rockstore/i, latitude: 43.6085, longitude: 3.8772 },
  { match: /olympia/i, latitude: 48.8699, longitude: 2.3282 },
  { match: /place du peyrou|peyrou/i, latitude: 43.6112, longitude: 3.8703 },
  { match: /corum|opéra berlioz|opera berlioz/i, latitude: 43.612, longitude: 3.8805 },
  { match: /solar festival/i, latitude: 43.6489, longitude: 3.8567 },
  { match: /d[eé]ferlantes|argel[eè]s-sur-mer/i, latitude: 42.5467, longitude: 3.0222 },
  { match: /rock en seine|saint-cloud/i, latitude: 48.8422, longitude: 2.2183 },
  { match: /nuits sonores/i, latitude: 45.764, longitude: 4.8357 },
  { match: /bar musical/i, latitude: 45.764, longitude: 4.8357 },
  { match: /café des arts|cafe des arts/i, latitude: 44.8378, longitude: -0.5792 },
  { match: /place de la com[eé]die/i, latitude: 43.608, longitude: 3.8778 },
  { match: /place du mill[eé]naire|antigone/i, latitude: 43.6088, longitude: 3.8855 },
  { match: /le polygone|polygone/i, latitude: 43.5745, longitude: 3.8578 },
  { match: /jazz [àa] juan|pin[eè]de gould/i, latitude: 43.5804, longitude: 7.1251 },
  { match: /vieilles charrues|carhaix/i, latitude: 48.2758, longitude: -3.5744 },
  { match: /longchamp|lollapalooza/i, latitude: 48.8575, longitude: 2.2415 },
  { match: /francofolies/i, latitude: 46.1603, longitude: -1.1511 },
  { match: /calvi on the rocks/i, latitude: 42.5676, longitude: 8.757 },
];

const CITY_LOOKUP: Array<{ match: RegExp; latitude: number; longitude: number }> = [
  { match: /paris/i, latitude: 48.8566, longitude: 2.3522 },
  { match: /montpellier/i, latitude: 43.6108, longitude: 3.8767 },
  { match: /le cr[eè]s|^cr[eè]s$/i, latitude: 43.6489, longitude: 3.9394 },
  { match: /lyon/i, latitude: 45.764, longitude: 4.8357 },
  { match: /bordeaux/i, latitude: 44.8378, longitude: -0.5792 },
  { match: /argel[eè]s-sur-mer|argel[eè]s/i, latitude: 42.5467, longitude: 3.0222 },
  { match: /antibes/i, latitude: 43.5804, longitude: 7.1251 },
  { match: /carhaix/i, latitude: 48.2758, longitude: -3.5744 },
  { match: /la rochelle/i, latitude: 46.1603, longitude: -1.1511 },
  { match: /calvi/i, latitude: 42.5676, longitude: 8.757 },
  { match: /boom|tomorrowland/i, latitude: 51.1624, longitude: 4.3707 },
  { match: /glastonbury|pilton|somerset/i, latitude: 51.155, longitude: -2.585 },
  { match: /indio|coachella/i, latitude: 33.7206, longitude: -116.2156 },
  { match: /niigata|fuji rock/i, latitude: 37.9161, longitude: 139.0364 },
  { match: /rio de janeiro/i, latitude: -22.9068, longitude: -43.1729 },
  { match: /miami/i, latitude: 25.7617, longitude: -80.1918 },
  { match: /amsterdam/i, latitude: 52.3676, longitude: 4.9041 },
  { match: /barcelona/i, latitude: 41.3874, longitude: 2.1686 },
  { match: /rabat|morocco|maroc/i, latitude: 34.0209, longitude: -6.8416 },
  { match: /\bgoa\b/i, latitude: 15.2993, longitude: 74.124 },
  { match: /belgium|belgique/i, latitude: 50.8503, longitude: 4.3517 },
  { match: /netherlands|pays-bas/i, latitude: 52.3676, longitude: 4.9041 },
  { match: /japan|japon/i, latitude: 35.6762, longitude: 139.6503 },
  { match: /\bindia\b|\binde\b/i, latitude: 20.5937, longitude: 78.9629 },
  { match: /brazil|br[eé]sil/i, latitude: -14.235, longitude: -51.9253 },
  { match: /california/i, latitude: 36.7783, longitude: -119.4179 },
  { match: /united kingdom|royaume-uni/i, latitude: 55.3781, longitude: -3.436 },
  { match: /spain|espagne/i, latitude: 40.4637, longitude: -3.7492 },
  { match: /florida/i, latitude: 27.6648, longitude: -81.5158 },
];

const geocodeCache = new Map<string, { latitude: number; longitude: number }>();

function cacheKey(location: string): string {
  return location.trim().toLowerCase();
}

/** Enregistre des coords connues (sélection Nominatim, GPS, etc.). */
export function cacheEventCoords(
  location: string,
  coords: { latitude: number; longitude: number }
): void {
  const key = cacheKey(location);
  if (key) geocodeCache.set(key, coords);
}

/** Résolution synchrone venue uniquement — pas de fallback ville. */
export function resolveEventVenueCoordsSync(
  location: string
): { latitude: number; longitude: number } | null {
  const loc = location.trim();
  if (!loc) return null;
  for (const v of VENUE_LOOKUP) {
    if (v.match.test(loc)) return { latitude: v.latitude, longitude: v.longitude };
  }
  return null;
}

function matchCityLookup(label: string): { latitude: number; longitude: number } | null {
  const loc = label.trim();
  if (!loc) return null;
  for (const c of CITY_LOOKUP) {
    if (c.match.test(loc)) return { latitude: c.latitude, longitude: c.longitude };
  }
  return null;
}

/** Dernier recours : centre-ville approximatif (segments d'adresse puis chaîne entière). */
export function resolveEventCityCoordsSync(
  location: string
): { latitude: number; longitude: number } | null {
  const loc = location.trim();
  if (!loc) return null;

  const direct = matchCityLookup(loc);
  if (direct) return direct;

  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const coords = matchCityLookup(parts[i]!);
    if (coords) return coords;
  }

  return null;
}

/** Résolution synchrone (venues + cache) — sans appel réseau. */
export function resolveEventCoordsSync(
  location: string
): { latitude: number; longitude: number } | null {
  const venue = resolveEventVenueCoordsSync(location);
  if (venue) return venue;
  const cached = geocodeCache.get(cacheKey(location));
  return cached ?? null;
}

/** Résolution synchrone groupée (venues, cache, centre-ville) — sans réseau. */
export function resolveManyEventCoordsSync(
  locations: readonly string[]
): Map<string, { latitude: number; longitude: number }> {
  const out = new Map<string, { latitude: number; longitude: number }>();
  for (const raw of locations) {
    const loc = raw.trim();
    if (!loc || out.has(loc)) continue;

    const cached = geocodeCache.get(cacheKey(loc));
    if (cached) {
      out.set(loc, cached);
      continue;
    }

    const coords = resolveEventCoordsSync(loc) ?? resolveEventCityCoordsSync(loc);
    if (coords) {
      geocodeCache.set(cacheKey(loc), coords);
      out.set(loc, coords);
    }
  }
  return out;
}

/** Géocode async les lieux non résolus (dédupliqués, rate-limit Nominatim). */
export async function resolveManyEventCoordsRemaining(
  locations: readonly string[],
  resolved: ReadonlyMap<string, { latitude: number; longitude: number }>,
  opts?: { signal?: { cancelled: boolean } }
): Promise<Map<string, { latitude: number; longitude: number }>> {
  const out = new Map(resolved);
  const pending = [
    ...new Set(locations.map((l) => l.trim()).filter((l) => l && !out.has(l))),
  ];

  for (const loc of pending) {
    if (opts?.signal?.cancelled) break;
    const coords = await resolveEventCoords(loc);
    if (coords) out.set(loc, coords);
  }
  return out;
}

/**
 * Résolution complète : venue → cache → Nominatim → centre-ville.
 * La ville n'est utilisée qu'en dernier recours pour ne pas masquer l'adresse réelle.
 */
export async function resolveEventCoords(
  location: string
): Promise<{ latitude: number; longitude: number } | null> {
  const sync = resolveEventCoordsSync(location);
  if (sync) return sync;

  const key = cacheKey(location);
  if (!key) return null;

  try {
    const result = await geocodeQuery(location);
    const coords = { latitude: result.latitude, longitude: result.longitude };
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    return resolveEventCityCoordsSync(location);
  }
}

/** Vide le cache géocode (tests uniquement). */
export function clearEventCoordsCacheForTests(): void {
  geocodeCache.clear();
}
