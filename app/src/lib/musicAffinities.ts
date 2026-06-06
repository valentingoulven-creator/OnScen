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
