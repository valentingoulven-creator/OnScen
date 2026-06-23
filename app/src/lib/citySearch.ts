import { PRESET_CITIES, presetCityToSuggestion, type PresetCity } from './livesGeo';

export interface CitySuggestion {
  label: string;
  subtitle?: string;
  postalCode?: string;
  value: string;
  latitude?: number;
  longitude?: number;
}

interface GouvCommune {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux?: string[];
  centre?: { type: string; coordinates: [number, number] };
}

interface NominatimResult {
  name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    postcode?: string;
  };
}

const GOUV_API = 'https://geo.api.gouv.fr/communes';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const MAX_SUGGESTIONS = 8;
const USER_AGENT = 'MeloSong/1.0 (city search; https://github.com/melosong)';

function primaryPostcode(codes?: string[]): string | undefined {
  return codes?.find(Boolean)?.trim();
}

function matchesPostcodeQuery(c: PresetCity, query: string): boolean {
  const cp = c.postalCode?.trim();
  if (!cp) return false;
  return cp.startsWith(query) || cp.includes(query);
}

function presetCitySuggestions(query: string): CitySuggestion[] {
  const q = query.trim().toLowerCase();
  const qDigits = query.trim();
  if (q.length < 2 && qDigits.length < 2) return [];

  return PRESET_CITIES.filter((c) => {
    const main = c.label.split(',')[0].trim().toLowerCase();
    if (main.startsWith(q) || c.label.toLowerCase().includes(q) || c.id.replace(/-/g, ' ').includes(q)) {
      return true;
    }
    if (/^\d{2,5}$/.test(qDigits) && matchesPostcodeQuery(c, qDigits)) return true;
    return false;
  })
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => {
      const mapped = presetCityToSuggestion(c);
      const value = c.label.split(',')[0]?.trim() || c.label;
      return {
        label: mapped.label,
        subtitle: mapped.postalCode,
        postalCode: mapped.postalCode,
        value,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
      };
    });
}

function gouvCommuneToSuggestion(c: GouvCommune): CitySuggestion | null {
  const [lon, lat] = c.centre?.coordinates ?? [];
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  if (!hasCoords) return null;
  const cp = primaryPostcode(c.codesPostaux);
  const label = cp ? `${c.nom} (${cp})` : c.nom;
  return {
    label,
    subtitle: cp ?? `Dép. ${c.codeDepartement}`,
    postalCode: cp,
    value: c.nom,
    latitude: lat,
    longitude: lon,
  };
}

async function fetchGouvCommunes(query: string): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    nom: query.trim(),
    boost: 'population',
    limit: String(MAX_SUGGESTIONS),
    fields: 'nom,code,codeDepartement,codesPostaux,centre',
  });
  const res = await fetch(`${GOUV_API}?${params}`);
  if (!res.ok) throw new Error('geo.api.gouv.fr indisponible');
  const data = (await res.json()) as GouvCommune[];
  return data
    .map(gouvCommuneToSuggestion)
    .filter((s): s is CitySuggestion => s != null);
}

async function fetchGouvByPostcode(code: string): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    codePostal: code,
    fields: 'nom,code,codeDepartement,codesPostaux,centre',
    limit: String(MAX_SUGGESTIONS),
  });
  const res = await fetch(`${GOUV_API}?${params}`);
  if (!res.ok) throw new Error('geo.api.gouv.fr indisponible');
  const data = (await res.json()) as GouvCommune[];
  return data
    .map(gouvCommuneToSuggestion)
    .filter((s): s is CitySuggestion => s != null);
}

async function fetchNominatimCities(query: string): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: String(MAX_SUGGESTIONS),
    featuretype: 'city',
    addressdetails: '1',
    'accept-language': 'fr',
  });
  const res = await fetch(`${NOMINATIM_API}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Nominatim indisponible');
  const data = (await res.json()) as NominatimResult[];
  return data.flatMap((r) => {
    const name = r.address?.city || r.address?.town || r.address?.village || r.name;
    if (!name) return [];
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    if (!hasCoords) return [];
    const cp = r.address?.postcode?.trim();
    const country = r.address?.country?.trim();
    const label = cp ? `${name} (${cp})` : name;
    return [
      {
        label,
        subtitle: cp ?? country,
        postalCode: cp,
        value: name,
        latitude: lat,
        longitude: lon,
      },
    ];
  });
}

function dedupeSuggestions(items: CitySuggestion[]): CitySuggestion[] {
  const out: CitySuggestion[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.label.toLowerCase()}|${item.postalCode ?? ''}|${item.latitude ?? ''}|${item.longitude ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Recherche de villes — geo.api.gouv.fr (France, codes postaux) + Nominatim (international),
 * avec repli sur les villes prédéfinies en cas d'échec des deux APIs.
 */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const presets = presetCitySuggestions(q);
  const isPostcodeQuery = /^\d{2,5}$/.test(q);

  try {
    if (isPostcodeQuery) {
      const byCp = await fetchGouvByPostcode(q);
      if (byCp.length > 0) return dedupeSuggestions([...byCp, ...presets]);
    }

    const [gouvSettled, nominatimSettled] = await Promise.allSettled([
      fetchGouvCommunes(q),
      fetchNominatimCities(q),
    ]);

    const fromGouv = gouvSettled.status === 'fulfilled' ? gouvSettled.value : [];
    const fromNominatim = nominatimSettled.status === 'fulfilled' ? nominatimSettled.value : [];

    if (fromGouv.length === 0 && fromNominatim.length === 0) {
      return presets;
    }

    const seen = new Set(fromGouv.map((c) => `${c.value.toLowerCase()}|${c.postalCode ?? ''}`));
    const dedupedNominatim = fromNominatim.filter(
      (c) => !seen.has(`${c.value.toLowerCase()}|${c.postalCode ?? ''}`)
    );

    return dedupeSuggestions([...fromGouv, ...dedupedNominatim, ...presets]);
  } catch {
    return presets;
  }
}
