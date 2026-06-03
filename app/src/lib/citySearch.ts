import { PRESET_CITIES } from './livesGeo';

export interface CitySuggestion {
  label: string;
  value: string;
}

interface GouvCommune {
  nom: string;
  codeDepartement: string;
}

const GOUV_API = 'https://geo.api.gouv.fr/communes';
const MAX_SUGGESTIONS = 8;

function presetCitySuggestions(query: string): CitySuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return PRESET_CITIES.filter((c) => c.label.toLowerCase().includes(q))
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => {
      const value = c.label.split(',')[0]?.trim() || c.label;
      return { label: c.label, value };
    });
}

async function fetchGouvCommunes(query: string): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    nom: query.trim(),
    boost: 'population',
    limit: String(MAX_SUGGESTIONS),
    fields: 'nom,codeDepartement',
  });
  const res = await fetch(`${GOUV_API}?${params}`);
  if (!res.ok) throw new Error('geo.api.gouv.fr indisponible');
  const data = (await res.json()) as GouvCommune[];
  return data.map((c) => ({
    label: `${c.nom} (${c.codeDepartement})`,
    value: c.nom,
  }));
}

/** Recherche de villes (API gouv, repli sur villes prédéfinies msdev). */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const fromApi = await fetchGouvCommunes(q);
    if (fromApi.length > 0) return fromApi;
  } catch {
    /* repli ci-dessous */
  }

  return presetCitySuggestions(q);
}
