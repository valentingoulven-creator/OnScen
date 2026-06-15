import type { Sponsor, SponsorPlacement } from '../types';

export type SponsorPlacementTab = SponsorPlacement | 'all';

export const SPONSOR_PLACEMENT_TABS: SponsorPlacementTab[] = [
  'map_banner',
  'feed_inline',
  'stories_banner',
  'reels_sponsored',
  'all',
];

export function placementTabToApiPlacement(tab: SponsorPlacementTab): SponsorPlacement | undefined {
  return tab === 'all' ? undefined : tab;
}

export function defaultPlacementForTab(tab: SponsorPlacementTab): SponsorPlacement {
  return tab === 'all' ? 'map_banner' : tab;
}

/** Réordonne les ids complets en ne permutant que le groupe du placement donné. */
export function reorderSponsorIdsWithinPlacement(
  allSponsors: Sponsor[],
  placement: SponsorPlacement,
  id: string,
  direction: 'up' | 'down'
): string[] | null {
  const sorted = [...allSponsors].sort((a, b) => a.priority - b.priority || b.updatedAt - a.updatedAt);
  const group = sorted.filter((s) => s.placement === placement);
  const idx = group.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= group.length) return null;

  const nextGroup = [...group];
  [nextGroup[idx], nextGroup[swapIdx]] = [nextGroup[swapIdx], nextGroup[idx]];

  const groupIds = new Set(group.map((s) => s.id));
  const result: string[] = [];
  let groupCursor = 0;
  for (const sponsor of sorted) {
    if (groupIds.has(sponsor.id)) {
      result.push(nextGroup[groupCursor]!.id);
      groupCursor += 1;
    } else {
      result.push(sponsor.id);
    }
  }
  return result;
}

export function countsForSponsors(items: Sponsor[]): { total: number; active: number; inactive: number } {
  const total = items.length;
  const active = items.filter((s) => s.active).length;
  return { total, active, inactive: total - active };
}
