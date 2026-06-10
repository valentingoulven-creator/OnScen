import { POPULAR_GENRES } from './popularGenres';
import { searchList, type ListSuggestion } from './listSearch';

/** Recherche locale dans les genres populaires (préfixe, casse/accents ignorés). */
export function searchGenres(query: string, exclude: string[] = []): ListSuggestion[] {
  return searchList(POPULAR_GENRES, query, exclude);
}
