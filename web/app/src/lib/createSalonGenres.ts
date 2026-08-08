import { normalizeTag } from './musicAffinities';
import { POPULAR_GENRES } from './popularGenres';

export const CREATE_SALON_GENRES_STORAGE_KEY = 'onscen_create_salon_genres';
export const MAX_CREATE_SALON_GENRES = 10;

/** Liste de suggestions : genres populaires + genres profil absents de la liste. */
export function resolveCreateSalonGenreOptions(profileGenres?: string[]): string[] {
  const popularNorm = new Set(POPULAR_GENRES.map(normalizeTag));
  const extras = (profileGenres ?? [])
    .map((g) => g.trim())
    .filter(Boolean)
    .filter((g) => !popularNorm.has(normalizeTag(g)));
  return [...extras, ...POPULAR_GENRES];
}

export function readSavedCreateSalonGenres(): string[] {
  try {
    const raw = localStorage.getItem(CREATE_SALON_GENRES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      .slice(0, MAX_CREATE_SALON_GENRES);
  } catch {
    return [];
  }
}

export function writeSavedCreateSalonGenres(genres: string[]): void {
  try {
    localStorage.setItem(
      CREATE_SALON_GENRES_STORAGE_KEY,
      JSON.stringify(
        genres.map((g) => g.trim()).filter(Boolean).slice(0, MAX_CREATE_SALON_GENRES)
      )
    );
  } catch {
    /* ignore */
  }
}

export function resolveInitialCreateSalonGenres(profileGenres?: string[]): string[] {
  const options = resolveCreateSalonGenreOptions(profileGenres);
  const optionNorms = new Set(options.map(normalizeTag));
  const saved = readSavedCreateSalonGenres().filter((g) => optionNorms.has(normalizeTag(g)));
  if (saved.length > 0) return saved.slice(0, MAX_CREATE_SALON_GENRES);
  const fromProfile = (profileGenres ?? []).filter((g) => optionNorms.has(normalizeTag(g)));
  if (fromProfile.length > 0) return fromProfile.slice(0, MAX_CREATE_SALON_GENRES);
  return [];
}

export function isAllCreateSalonGenresSelected(selected: string[], options: string[]): boolean {
  if (options.length === 0) return false;
  const target = options.slice(0, MAX_CREATE_SALON_GENRES);
  const sel = new Set(selected.map(normalizeTag));
  return target.every((g) => sel.has(normalizeTag(g)));
}

export function selectAllCreateSalonGenres(options: string[]): string[] {
  return options.slice(0, MAX_CREATE_SALON_GENRES);
}

export function toggleCreateSalonGenre(selected: string[], genre: string): string[] {
  const norm = normalizeTag(genre);
  const has = selected.some((g) => normalizeTag(g) === norm);
  if (has) {
    return selected.filter((g) => normalizeTag(g) !== norm);
  }
  if (selected.length >= MAX_CREATE_SALON_GENRES) return selected;
  return [...selected, genre];
}

export function filterCreateSalonGenreSuggestions(
  options: string[],
  query: string
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((g) => g.toLowerCase().includes(q));
}
