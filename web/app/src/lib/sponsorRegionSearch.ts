import type { CitySuggestion } from './citySearch';

const API = '/api/geo/geocode';
const DEFAULT_LIMIT = 5;

export async function searchSponsorRegions(query: string, limit = DEFAULT_LIMIT): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error('Géocodage indisponible');

  const data = (await res.json()) as { results?: CitySuggestion[] };
  return Array.isArray(data.results) ? data.results : [];
}
