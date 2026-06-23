import type { Sponsor, SponsorPlacement } from '../types';

export type SponsorPlacementTab = SponsorPlacement | 'all';

export const SPONSOR_PLACEMENT_TABS: SponsorPlacementTab[] = [
  'map_banner',
  'feed_inline',
  'stories_banner',
  'stories_sponsored',
  'reels_sponsored',
  'salon_theater',
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

/** Sponsor réellement diffusé (flag actif + fenêtre de dates). */
export function isSponsorActiveAt(sponsor: Sponsor, at = Date.now()): boolean {
  if (!sponsor.active) return false;
  if (sponsor.startsAt != null && at < sponsor.startsAt) return false;
  if (sponsor.endsAt != null && at > sponsor.endsAt) return false;
  return true;
}

export function countsForSponsors(items: Sponsor[]): { total: number; active: number; inactive: number } {
  const total = items.length;
  const active = items.filter((s) => isSponsorActiveAt(s)).length;
  return { total, active, inactive: total - active };
}
