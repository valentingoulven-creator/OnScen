import { POPULAR_INTERESTS } from './popularInterests';
import { searchList, type ListSuggestion } from './listSearch';

/** Recherche locale dans les centres d'intérêt suggérés. */
export function searchInterests(query: string, exclude: string[] = []): ListSuggestion[] {
  return searchList(POPULAR_INTERESTS, query, exclude);
}
