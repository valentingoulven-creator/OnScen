import { describe, expect, it } from 'vitest';
import type { Sponsor } from '../types';
import {
  countsForSponsors,
  defaultPlacementForTab,
  placementTabToApiPlacement,
  reorderSponsorIdsWithinPlacement,
} from './sponsorAdminPlacement';

function mockSponsor(
  id: string,
  placement: Sponsor['placement'],
  priority: number
): Sponsor {
  return {
    id,
    name: id,
    placement,
    active: true,
    priority,
    title: 'T',
    subtitle: 'S',
    cta: 'C',
    accent: 'purple',
    kind: 'promo',
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('sponsorAdminPlacement', () => {
  it('mappe les sous-onglets vers le filtre API', () => {
    expect(placementTabToApiPlacement('map_banner')).toBe('map_banner');
    expect(placementTabToApiPlacement('all')).toBeUndefined();
  });

  it('choisit le placement par défaut selon l’onglet actif', () => {
    expect(defaultPlacementForTab('feed_inline')).toBe('feed_inline');
    expect(defaultPlacementForTab('all')).toBe('map_banner');
  });

  it('réordonne uniquement le groupe du placement', () => {
    const all = [
      mockSponsor('m1', 'map_banner', 0),
      mockSponsor('f1', 'feed_inline', 1),
      mockSponsor('m2', 'map_banner', 2),
      mockSponsor('s1', 'stories_banner', 3),
    ];
    const ids = reorderSponsorIdsWithinPlacement(all, 'map_banner', 'm2', 'up');
    expect(ids).toEqual(['m2', 'f1', 'm1', 's1']);
  });

  it('compte les sponsors filtrés', () => {
    const items = [
      mockSponsor('a', 'map_banner', 0),
      { ...mockSponsor('b', 'map_banner', 1), active: false },
    ];
    expect(countsForSponsors(items)).toEqual({ total: 2, active: 1, inactive: 1 });
  });
});
