import type { GlobalSearchResultItem } from './globalSearchTypes';

export type GlobalSearchFilter = 'all' | 'user' | 'event' | 'city';

export function matchesGlobalSearchFilter(  item: GlobalSearchResultItem,
  filter: GlobalSearchFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'user') return item.kind === 'user';
  if (filter === 'event') return item.kind === 'event';
  if (filter === 'city') return item.kind === 'city' || item.kind === 'country';
  return true;
}

export function filterGlobalSearchResults(
  items: GlobalSearchResultItem[],
  filter: GlobalSearchFilter
): GlobalSearchResultItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => matchesGlobalSearchFilter(item, filter));
}
