import { describe, expect, it } from 'vitest';
import {
  countMusicalAffinityMatches,
  hasMusicalAffinity,
  normalizeTag,
  viewerHasTasteProfile,
} from './musicAffinities';
import { filterNearbyPeople } from './nearbyPanelSettings';
import type { NearbyPerson } from '../types';

describe('musicAffinities', () => {
  it('compare les tags sans tenir compte de la casse', () => {
    expect(normalizeTag('  Hip-Hop ')).toBe('hip-hop');
    expect(
      hasMusicalAffinity(
        { favoriteGenres: ['Hip-hop'] },
        { favoriteGenres: ['hip-hop'] }
      )
    ).toBe(true);
  });

  it('compte les correspondances sur intérêts, genres et artistes', () => {
    const viewer = {
      interests: ['Live', 'Vinyles'],
      favoriteGenres: ['Jazz'],
      favoriteArtists: ['Daft Punk'],
    };
    const person = {
      interests: ['live'],
      favoriteGenres: ['Rock', 'Jazz'],
      favoriteArtists: ['Phoenix'],
    };
    expect(countMusicalAffinityMatches(viewer, person)).toBe(2);
    expect(hasMusicalAffinity(viewer, person)).toBe(true);
  });

  it('viewerHasTasteProfile est faux si toutes les listes sont vides', () => {
    expect(viewerHasTasteProfile({})).toBe(false);
  });
});

describe('filterNearbyPeople musical affinities', () => {
  const people: NearbyPerson[] = [
    {
      id: 'a',
      username: 'a',
      interests: ['Live'],
    },
    {
      id: 'b',
      username: 'b',
      favoriteGenres: ['Rock'],
    },
  ];

  it('filtre par affinités quand musicalAffinitiesOnly est actif', () => {
    const filtered = filterNearbyPeople(
      people,
      { platformFilter: 'all', livesOnly: false, musicalAffinitiesOnly: true },
      { interests: ['Live'] }
    );
    expect(filtered.map((p) => p.id)).toEqual(['a']);
  });
});
