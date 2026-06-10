export interface ListSuggestion {
  label: string;
  value: string;
}

const MAX_SUGGESTIONS = 8;

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Filtre une liste par préfixe (insensible à la casse / accents), exclut les tags déjà choisis. */
export function searchList(
  items: readonly string[],
  query: string,
  exclude: string[] = [],
  maxResults = MAX_SUGGESTIONS
): ListSuggestion[] {
  const q = normalize(query);
  if (!q) return [];

  const excluded = new Set(exclude.map(normalize));

  return items
    .filter((item) => {
      if (excluded.has(normalize(item))) return false;
      return normalize(item).startsWith(q);
    })
    .slice(0, maxResults)
    .map((item) => ({ label: item, value: item }));
}
