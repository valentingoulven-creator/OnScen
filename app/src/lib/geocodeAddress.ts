export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  label: string;
}

export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'MeloSong/1.0 (map location; https://github.com/melosong)';
const MIN_QUERY_LEN = 5;
const MIN_SUGGEST_QUERY_LEN = 3;
const MAX_ADDRESS_SUGGESTIONS = 6;
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

/** Propositions d’adresses (Nominatim, plusieurs résultats). */
export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_SUGGEST_QUERY_LEN) return [];

  await waitForRateLimit();

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: String(MAX_ADDRESS_SUGGESTIONS),
    addressdetails: '0',
  });

  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as NominatimResult[];
  const out: AddressSuggestion[] = [];
  for (const hit of data) {
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const label =
      typeof hit.display_name === 'string' && hit.display_name ? hit.display_name : q;
    out.push({ label, latitude, longitude });
  }
  return out;
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

/** Géocode une ligne d’adresse libre. */
export async function geocodeQuery(query: string): Promise<GeocodedAddress> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LEN) {
    throw new Error('Adresse trop courte.');
  }

  await waitForRateLimit();

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });

  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error('Service de géocodage indisponible. Réessayez plus tard.');
  }

  const data = (await res.json()) as NominatimResult[];
  const hit = data[0];
  if (!hit) {
    throw new Error('Adresse introuvable. Vérifiez rue, code postal et ville.');
  }

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Réponse de géocodage invalide.');
  }

  const label = typeof hit.display_name === 'string' && hit.display_name ? hit.display_name : q;
  return { latitude, longitude, label };
}

/** Réinitialise le délai Nominatim (tests uniquement). */
export function resetGeocodeRateLimitForTests(): void {
  lastRequestAt = 0;
}
