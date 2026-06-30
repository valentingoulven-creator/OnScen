/** Champs profil utilisés pour les affinités musicales (à proximité). */
export interface ProfileTastes {
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags: string[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const t of tags ?? []) {
    const n = normalizeTag(t);
    if (n) set.add(n);
  }
  return set;
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) n += 1;
  }
  return n;
}

/** Nombre de centres d'intérêt, genres et artistes en commun (chaque tag compte une fois). */
export function countMusicalAffinityMatches(viewer: ProfileTastes, person: ProfileTastes): number {
  return (
    countOverlap(normalizeTags(viewer.interests), normalizeTags(person.interests)) +
    countOverlap(normalizeTags(viewer.favoriteGenres), normalizeTags(person.favoriteGenres)) +
    countOverlap(normalizeTags(viewer.favoriteArtists), normalizeTags(person.favoriteArtists))
  );
}

export function hasMusicalAffinity(viewer: ProfileTastes, person: ProfileTastes): boolean {
  return countMusicalAffinityMatches(viewer, person) > 0;
}

export function viewerHasTasteProfile(viewer: ProfileTastes): boolean {
  return (
    normalizeTags(viewer.interests).size > 0 ||
    normalizeTags(viewer.favoriteGenres).size > 0 ||
    normalizeTags(viewer.favoriteArtists).size > 0
  );
}

/** Filtre genres carte Salon : tous les genres proposés ou sous-ensemble sélectionné. */
export type SalonAffinityGenreFilter = 'all' | string[];

export function personMatchesSalonGenreFilter(
  person: ProfileTastes,
  filter: SalonAffinityGenreFilter,
  genreOptions: string[]
): boolean {
  const personGenres = normalizeTags(person.favoriteGenres);
  if (personGenres.size === 0) return false;

  const targetGenres =
    filter === 'all' ? normalizeTags(genreOptions) : normalizeTags(filter);
  if (targetGenres.size === 0) return false;

  for (const g of targetGenres) {
    if (personGenres.has(g)) return true;
  }
  return false;
}

export function isSalonGenreSelected(
  filter: SalonAffinityGenreFilter | null,
  genre: string
): boolean {
  if (filter === 'all') return true;
  if (!filter) return false;
  const norm = normalizeTag(genre);
  return filter.some((g) => normalizeTag(g) === norm);
}

export function toggleSalonGenreFilter(
  filter: SalonAffinityGenreFilter | null,
  genre: string,
  genreOptions: string[]
): SalonAffinityGenreFilter | null {
  const norm = normalizeTag(genre);
  const options = genreOptions.filter((g) => normalizeTag(g));

  if (filter === 'all') {
    const next = options.filter((g) => normalizeTag(g) !== norm);
    return next.length === 0 ? null : next;
  }

  if (!filter) {
    return [genre];
  }

  const has = filter.some((g) => normalizeTag(g) === norm);
  if (has) {
    const next = filter.filter((g) => normalizeTag(g) !== norm);
    return next.length === 0 ? null : next;
  }

  const next = [...filter, genre];
  if (next.length >= options.length) return 'all';
  return next;
}
