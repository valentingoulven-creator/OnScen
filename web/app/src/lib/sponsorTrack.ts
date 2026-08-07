import type { SponsorPlacement } from '../types';
import { api } from './api';

const STATIC_AD_IDS = new Set(['salon', 'live']);

function sessionImpressionKey(sponsorId: string, placement: SponsorPlacement): string {
  return `soundy:sponsor:imp:${sponsorId}:${placement}`;
}

function shouldTrackSponsorId(sponsorId: string | undefined): sponsorId is string {
  return Boolean(sponsorId && !STATIC_AD_IDS.has(sponsorId));
}

export function trackSponsorImpression(sponsorId: string, placement: SponsorPlacement): void {
  if (!shouldTrackSponsorId(sponsorId)) return;
  if (typeof sessionStorage !== 'undefined') {
    const key = sessionImpressionKey(sponsorId, placement);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  }
  void api.trackSponsorEvent({ sponsorId, placement, event: 'impression' }).catch(() => {});
}

export function trackSponsorClick(sponsorId: string, placement: SponsorPlacement): void {
  if (!shouldTrackSponsorId(sponsorId)) return;
  void api.trackSponsorEvent({ sponsorId, placement, event: 'click' }).catch(() => {});
}

export const SPONSOR_PLACEMENT_BY_FETCH = {
  map: 'map_banner',
  feed: 'feed_inline',
  stories: 'stories_banner',
  salon: 'salon_theater',
} as const satisfies Record<'map' | 'feed' | 'stories' | 'salon', SponsorPlacement>;
