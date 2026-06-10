import { PRESET_CITIES } from './livesGeo';

export interface CitySuggestion {
  label: string;
  subtitle?: string;
  value: string;
  latitude?: number;
  longitude?: number;
}

interface GouvCommune {
  nom: string;
  codeDepartement: string;
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
  };
}

const GOUV_API = 'https://geo.api.gouv.fr/communes';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const MAX_SUGGESTIONS = 5;

function presetCitySuggestions(query: string): CitySuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return PRESET_CITIES.filter((c) => c.label.toLowerCase().includes(q))
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => {
      const value = c.label.split(',')[0]?.trim() || c.label;
      return { label: c.label, value, latitude: c.latitude, longitude: c.longitude };
    });
}

async function fetchGouvCommunes(query: string): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    nom: query.trim(),
    boost: 'population',
    limit: String(MAX_SUGGESTIONS),
    fields: 'nom,codeDepartement,centre',
  });
  const res = await fetch(`${GOUV_API}?${params}`);
  if (!res.ok) throw new Error('geo.api.gouv.fr indisponible');
  const data = (await res.json()) as GouvCommune[];
  return data.map((c) => {
    const [lon, lat] = c.centre?.coordinates ?? [];
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    return {
      label: c.nom,
      subtitle: `Dép. ${c.codeDepartement}`,
      value: c.nom,
      ...(hasCoords ? { latitude: lat, longitude: lon } : {}),
    };
  });
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
  const res = await fetch(`${NOMINATIM_API}?${params}`);
  if (!res.ok) throw new Error('Nominatim indisponible');
  const data = (await res.json()) as NominatimResult[];
  return data.flatMap((r) => {
    const name = r.address?.city || r.address?.town || r.address?.village || r.name;
    if (!name) return [];
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    return [
      {
        label: name,
        subtitle: r.address?.country,
        value: name,
        ...(hasCoords ? { latitude: lat, longitude: lon } : {}),
      },
    ];
  });
}

/**
 * Recherche de villes — geo.api.gouv.fr (France) + Nominatim (international),
 * avec repli sur les villes prédéfinies en cas d'échec des deux APIs.
 */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [gouvSettled, nominatimSettled] = await Promise.allSettled([
    fetchGouvCommunes(q),
    fetchNominatimCities(q),
  ]);

  const fromGouv = gouvSettled.status === 'fulfilled' ? gouvSettled.value : [];
  const fromNominatim = nominatimSettled.status === 'fulfilled' ? nominatimSettled.value : [];

  if (fromGouv.length === 0 && fromNominatim.length === 0) {
    return presetCitySuggestions(q);
  }

  const seen = new Set(fromGouv.map((c) => c.value.toLowerCase()));
  const deduped = fromNominatim.filter((c) => !seen.has(c.value.toLowerCase()));

  return [...fromGouv, ...deduped].slice(0, MAX_SUGGESTIONS);
}
