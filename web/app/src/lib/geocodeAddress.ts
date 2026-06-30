export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  label: string;
}

export type AddressPrecision = 'exact' | 'street' | 'city' | 'approximate';

export interface AddressSuggestion {
  label: string;
  fullLabel: string;
  latitude: number;
  longitude: number;
  precision: AddressPrecision;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  postcode?: string;
  country?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
  class?: string;
  type?: string;
  address?: NominatimAddress;
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'MeloSong/1.0 (map location; https://github.com/melosong)';
const MIN_QUERY_LEN = 5;
const MIN_SUGGEST_QUERY_LEN = 3;
const MAX_ADDRESS_SUGGESTIONS = 8;
let lastRequestAt = 0;

function buildQuery(parts: { street?: string; postalCode?: string; city?: string }): string {
  return [parts.street, parts.postalCode, parts.city]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');
}

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastRequestAt = Date.now();
}

/** Numéro de voie en tête de requête (ex. « 2 », « 12 bis »). */
export function extractQueryHouseNumber(query: string): string | null {
  const m = query.trim().match(/^(\d+(?:\s*(?:bis|ter|quater|a|b))?\b)/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

/** Sépare numéro de voie et reste de l'adresse (ex. « 2 rue … » → { streetNumber: « 2 », street: « rue … » }). */
export function splitAddressStreetNumber(value: string): { streetNumber: string; street: string } {
  const trimmed = value.trim();
  const streetNumber = extractQueryHouseNumber(trimmed);
  if (!streetNumber) return { streetNumber: '', street: trimmed };
  const street = trimmed.slice(streetNumber.length).trim();
  return { streetNumber, street };
}

/** Combine numéro optionnel et adresse en une ligne. */
export function combineAddressStreetNumber(streetNumber: string, street: string): string {
  const num = streetNumber.trim();
  const addr = street.trim();
  if (!num) return addr;
  if (!addr) return num;
  return `${num} ${addr}`;
}

function normalizeHouseNumber(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cityFromAddress(addr: NominatimAddress): string {
  return (
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim() ||
    ''
  );
}

function streetFromAddress(addr: NominatimAddress): string {
  const road = addr.road?.trim() || addr.pedestrian?.trim() || addr.footway?.trim() || '';
  const num = addr.house_number?.trim();
  if (num && road) return `${num} ${road}`;
  return road || num || '';
}

export function formatAddressLabels(hit: NominatimResult): { short: string; full: string } {
  const full =
    typeof hit.display_name === 'string' && hit.display_name.trim() ? hit.display_name.trim() : '';
  const addr = hit.address;
  if (addr) {
    const street = streetFromAddress(addr);
    const city = cityFromAddress(addr);
    if (street && city) return { short: `${street}, ${city}`, full: full || `${street}, ${city}` };
    if (street) return { short: street, full: full || street };
    if (city) return { short: city, full: full || city };
  }
  if (full) {
    const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
    return { short: parts.slice(0, 2).join(', '), full };
  }
  return { short: '', full: '' };
}

export function getAddressPrecision(hit: NominatimResult): AddressPrecision {
  const addr = hit.address;
  if (!addr) return 'approximate';
  if (addr.house_number?.trim()) return 'exact';
  if (addr.road?.trim() || addr.pedestrian?.trim()) return 'street';
  if (cityFromAddress(addr)) return 'city';
  return 'approximate';
}

function scoreNominatimHit(query: string, hit: NominatimResult): number {
  let score = typeof hit.importance === 'number' ? hit.importance : 0;
  const qNum = extractQueryHouseNumber(query);
  const addr = hit.address;

  if (qNum && addr?.house_number) {
    if (normalizeHouseNumber(addr.house_number) === normalizeHouseNumber(qNum)) score += 120;
    else score += 25;
  } else if (qNum && !addr?.house_number) {
    score -= 35;
  }

  if (hit.class === 'building' || hit.class === 'amenity') score += 18;
  if (hit.type === 'house' || hit.type === 'residential' || hit.type === 'apartments') score += 12;

  const road = (addr?.road || addr?.pedestrian || '').toLowerCase();
  const qLower = query.toLowerCase();
  if (road.length >= 4 && qLower.includes(road.slice(0, Math.min(road.length, 12)))) score += 28;

  const city = cityFromAddress(addr ?? {}).toLowerCase();
  if (city.length >= 3 && qLower.includes(city)) score += 15;

  return score;
}

function nominatimHitToSuggestion(hit: NominatimResult, fallbackQuery: string): AddressSuggestion | null {
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const { short, full } = formatAddressLabels(hit);
  const label = short || full || fallbackQuery;
  const fullLabel = full || label;

  return {
    label,
    fullLabel,
    latitude,
    longitude,
    precision: getAddressPrecision(hit),
  };
}

function rankNominatimHits(query: string, hits: NominatimResult[]): NominatimResult[] {
  return [...hits].sort((a, b) => scoreNominatimHit(query, b) - scoreNominatimHit(query, a));
}

function buildSearchParams(query: string, limit: number): URLSearchParams {
  return new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
    addressdetails: '1',
    dedupe: '1',
    countrycodes: 'fr',
  });
}

async function fetchNominatimSearch(query: string, limit: number): Promise<NominatimResult[]> {
  await waitForRateLimit();

  const params = buildSearchParams(query, limit);
  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return [];
  return (await res.json()) as NominatimResult[];
}

function hitsToSuggestions(query: string, hits: NominatimResult[]): AddressSuggestion[] {
  const ranked = rankNominatimHits(query, hits);
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();

  for (const hit of ranked) {
    const suggestion = nominatimHitToSuggestion(hit, query);
    if (!suggestion) continue;
    const key = `${suggestion.latitude.toFixed(5)}|${suggestion.longitude.toFixed(5)}|${suggestion.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= MAX_ADDRESS_SUGGESTIONS) break;
  }

  return out;
}

/** Propositions d'adresses (Nominatim, plusieurs résultats classés). */
export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_SUGGEST_QUERY_LEN) return [];

  const hits = await fetchNominatimSearch(q, MAX_ADDRESS_SUGGESTIONS + 2);
  return hitsToSuggestions(q, hits);
}

/** Géocode une adresse postale via Nominatim (OpenStreetMap). */
export async function geocodeAddress(parts: {
  street?: string;
  postalCode?: string;
  city?: string;
}): Promise<GeocodedAddress> {
  const query = buildQuery(parts);
  if (query.length < MIN_QUERY_LEN) {
    throw new Error('Saisissez au moins la rue et la ville (5 caractères minimum).');
  }
  return geocodeQuery(query);
}

/** Géocode une ligne d'adresse libre (meilleur résultat classé). */
export async function geocodeQuery(query: string): Promise<GeocodedAddress> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LEN) {
    throw new Error('Adresse trop courte.');
  }

  const hits = await fetchNominatimSearch(q, 6);
  const ranked = rankNominatimHits(q, hits);
  const hit = ranked[0];
  if (!hit) {
    throw new Error('Adresse introuvable. Vérifiez rue, code postal et ville.');
  }

  const suggestion = nominatimHitToSuggestion(hit, q);
  if (!suggestion) {
    throw new Error('Réponse de géocodage invalide.');
  }

  return {
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    label: suggestion.label,
  };
}

/** Géocode sans lever d'erreur — retourne null si échec. */
export async function geocodeQueryBestEffort(query: string): Promise<GeocodedAddress | null> {
  const q = query.trim();
  if (q.length < MIN_SUGGEST_QUERY_LEN) return null;
  try {
    return await geocodeQuery(q);
  } catch {
    try {
      const suggestions = await searchAddressSuggestions(q);
      const best = suggestions[0];
      if (!best) return null;
      return {
        latitude: best.latitude,
        longitude: best.longitude,
        label: best.label,
      };
    } catch {
      return null;
    }
  }
}

/** Pays (ISO + nom) à partir d'une ville ou adresse (Nominatim search). */
export async function geocodeCountryFromQuery(
  query: string
): Promise<{ code: string; name: string } | null> {
  const q = query.trim();
  if (q.length < 3) return null;

  await waitForRateLimit();

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    address?: { country_code?: string; country?: string };
  }>;
  const hit = data[0];
  const code = (hit?.address?.country_code ?? '').toUpperCase();
  const name = hit?.address?.country?.trim() ?? '';
  if (code.length !== 2) return null;
  return { code, name: name || code };
}

/** Libellé lieu (ville, pays) à partir de coordonnées GPS. */
export async function reverseGeocodeLocationLabel(
  latitude: number,
  longitude: number
): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Coordonnées invalides.');
  }

  await waitForRateLimit();

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  });

  const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error('Service de géocodage indisponible.');
  }

  const data = (await res.json()) as {
    display_name?: string;
    address?: NominatimAddress;
  };

  const street = streetFromAddress(data.address ?? {});
  const city = cityFromAddress(data.address ?? {});
  const country = data.address?.country?.trim();

  if (street && city) return `${street}, ${city}`;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;

  const display =
    typeof data.display_name === 'string' && data.display_name.trim()
      ? data.display_name.trim()
      : '';
  if (display) {
    const parts = display.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.slice(0, 3).join(', ');
  }

  throw new Error('Lieu introuvable pour cette position.');
}

/** Ville la plus proche à partir de coordonnées GPS (Nominatim reverse). */
export async function reverseGeocodeCity(latitude: number, longitude: number): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Coordonnées invalides.');
  }

  await waitForRateLimit();

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    zoom: '10',
  });

  const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error('Service de géocodage indisponible.');
  }

  const data = (await res.json()) as {
    address?: NominatimAddress;
  };

  const city = cityFromAddress(data.address ?? {});
  if (!city) {
    throw new Error('Ville introuvable pour cette position.');
  }

  return city;
}

/** Réinitialise le délai Nominatim (tests uniquement). */
export function resetGeocodeRateLimitForTests(): void {
  lastRequestAt = 0;
}
