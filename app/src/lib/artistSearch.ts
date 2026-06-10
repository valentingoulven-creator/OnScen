import { POPULAR_ARTISTS, type PopularArtist } from './popularArtists';

export interface ArtistSuggestion {
  label: string;
  subtitle?: string;
  value: string;
}

const MAX_SUGGESTIONS = 8;

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Recherche locale dans la liste d'artistes populaires Soundy.
 * L'utilisateur peut aussi saisir un nom personnalisé hors liste.
 */
export function searchArtists(query: string, exclude: string[] = []): ArtistSuggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const excluded = new Set(exclude.map((e) => normalize(e)));

  return POPULAR_ARTISTS.filter((a) => {
    if (excluded.has(normalize(a.name))) return false;
    const name = normalize(a.name);
    const genre = normalize(a.genre);
    return name.includes(q) || genre.includes(q);
  })
    .slice(0, MAX_SUGGESTIONS)
    .map(toSuggestion);
}

function toSuggestion(a: PopularArtist): ArtistSuggestion {
  return { label: a.name, subtitle: a.genre, value: a.name };
}
