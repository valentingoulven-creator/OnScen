import { describe, expect, it } from 'vitest';
import { filterGlobalSearchResults } from './globalSearchFilter';
import type { GlobalSearchResultItem } from './globalSearchTypes';

const sample: GlobalSearchResultItem[] = [
  { kind: 'city', label: 'Lyon', latitude: 45.75, longitude: 4.85 },
  { kind: 'event', id: 'e1', title: 'Concert', authorId: 'u1', authorUsername: 'dj' },
  { kind: 'user', id: 'u1', username: 'djval' },
  { kind: 'album', id: 'a1', userId: 'u1', title: 'Summer', authorUsername: 'dj' },
];

describe('filterGlobalSearchResults', () => {
  it('returns all items when filter is all', () => {
    expect(filterGlobalSearchResults(sample, 'all')).toHaveLength(4);
  });

  it('keeps only users for account filter', () => {
    expect(filterGlobalSearchResults(sample, 'user')).toEqual([
      { kind: 'user', id: 'u1', username: 'djval' },
    ]);
  });

  it('keeps only events for event filter', () => {
    expect(filterGlobalSearchResults(sample, 'event')).toEqual([
      { kind: 'event', id: 'e1', title: 'Concert', authorId: 'u1', authorUsername: 'dj' },
    ]);
  });

  it('keeps cities and countries for city filter', () => {
    expect(filterGlobalSearchResults(sample, 'city')).toEqual([
      { kind: 'city', label: 'Lyon', latitude: 45.75, longitude: 4.85 },
    ]);
    expect(
      filterGlobalSearchResults(
        [{ kind: 'country', label: 'France', latitude: 46.6, longitude: 1.8 }],
        'city'
      )
    ).toHaveLength(1);
  });
});
