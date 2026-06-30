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
];

const CITY_LOOKUP: Array<{ match: RegExp; latitude: number; longitude: number }> = [
  { match: /paris/i, latitude: 48.8566, longitude: 2.3522 },
  { match: /montpellier/i, latitude: 43.6108, longitude: 3.8767 },
  { match: /le cr[eè]s|^cr[eè]s$/i, latitude: 43.6489, longitude: 3.9394 },
  { match: /lyon/i, latitude: 45.764, longitude: 4.8357 },
  { match: /bordeaux/i, latitude: 44.8378, longitude: -0.5792 },
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
