import type { SponsorPlacement } from '../models/schema';
import { db } from '../models/schema';

export type SponsorAnalyticsEvent = 'impression' | 'click';

const VALID_PLACEMENTS = new Set<SponsorPlacement>([
  'map_banner',
  'map_sidebar_events',
  'feed_inline',
  'stories_banner',
  'stories_sponsored',
  'reels_sponsored',
  'salon_theater',
]);

const eventBuckets = new Map<string, { count: number }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function bucketKey(
  event: SponsorAnalyticsEvent,
  sponsorId: string,
  placement: SponsorPlacement,
  date = todayKey()
): string {
  return `${event}:${sponsorId}:${placement}:${date}`;
}

export function trackSponsorAnalyticsEvent(
  event: SponsorAnalyticsEvent,
  sponsorId: string,
  placement: SponsorPlacement
): void {
  if (!VALID_PLACEMENTS.has(placement)) return;
  if (!db.sponsors.some((s) => s.id === sponsorId)) return;
  const key = bucketKey(event, sponsorId, placement);
  const bucket = eventBuckets.get(key) ?? { count: 0 };
  bucket.count += 1;
  eventBuckets.set(key, bucket);
}

function sumEventLastNDays(
  event: SponsorAnalyticsEvent,
  sponsorId: string | null,
  placement: SponsorPlacement | null,
  days: number
): number {
  let total = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const day = date.toISOString().slice(0, 10);
    for (const [key, bucket] of eventBuckets.entries()) {
      if (!key.startsWith(`${event}:`) || !key.endsWith(`:${day}`)) continue;
      const parts = key.split(':');
      if (parts.length !== 4) continue;
      const [, sid, plc] = parts;
      if (sponsorId && sid !== sponsorId) continue;
      if (placement && plc !== placement) continue;
      total += bucket.count;
    }
  }
  return total;
}

function sumAllTime(event: SponsorAnalyticsEvent): number {
  let total = 0;
  const prefix = `${event}:`;
  for (const [key, bucket] of eventBuckets.entries()) {
    if (key.startsWith(prefix)) total += bucket.count;
  }
  return total;
}

function ctr(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 10000) / 100;
}

export interface SponsorAnalyticsPlacementRow {
  placement: SponsorPlacement;
  impressions30d: number;
  clicks30d: number;
  ctr30d: number;
}

export interface SponsorAnalyticsTopRow {
  sponsorId: string;
  sponsorName: string;
  impressions30d: number;
  clicks30d: number;
  ctr30d: number;
}

export interface SponsorAnalyticsSummary {
  impressionsTotal: number;
  clicksTotal: number;
  ctrTotal: number;
  impressions7d: number;
  clicks7d: number;
  ctr7d: number;
  impressions30d: number;
  clicks30d: number;
  ctr30d: number;
  byPlacement: SponsorAnalyticsPlacementRow[];
  topSponsors30d: SponsorAnalyticsTopRow[];
}

export function getSponsorAnalyticsSummary(topLimit = 10): SponsorAnalyticsSummary {
  const impressionsTotal = sumAllTime('impression');
  const clicksTotal = sumAllTime('click');
  const impressions7d = sumEventLastNDays('impression', null, null, 7);
  const clicks7d = sumEventLastNDays('click', null, null, 7);
  const impressions30d = sumEventLastNDays('impression', null, null, 30);
  const clicks30d = sumEventLastNDays('click', null, null, 30);

  const byPlacement: SponsorAnalyticsPlacementRow[] = [];
  for (const placement of VALID_PLACEMENTS) {
    const imp = sumEventLastNDays('impression', null, placement, 30);
    const clk = sumEventLastNDays('click', null, placement, 30);
    if (imp === 0 && clk === 0) continue;
    byPlacement.push({
      placement,
      impressions30d: imp,
      clicks30d: clk,
      ctr30d: ctr(clk, imp),
    });
  }
  byPlacement.sort((a, b) => b.impressions30d - a.impressions30d);

  const topSponsors30d: SponsorAnalyticsTopRow[] = db.sponsors
    .map((s) => {
      const imp = sumEventLastNDays('impression', s.id, null, 30);
      const clk = sumEventLastNDays('click', s.id, null, 30);
      return {
        sponsorId: s.id,
        sponsorName: s.name || s.title,
        impressions30d: imp,
        clicks30d: clk,
        ctr30d: ctr(clk, imp),
      };
    })
    .filter((r) => r.impressions30d > 0 || r.clicks30d > 0)
    .sort((a, b) => b.impressions30d - a.impressions30d)
    .slice(0, topLimit);

  return {
    impressionsTotal,
    clicksTotal,
    ctrTotal: ctr(clicksTotal, impressionsTotal),
    impressions7d,
    clicks7d,
    ctr7d: ctr(clicks7d, impressions7d),
    impressions30d,
    clicks30d,
    ctr30d: ctr(clicks30d, impressions30d),
    byPlacement,
    topSponsors30d,
  };
}

export function snapshotSponsorAnalyticsBuckets(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, bucket] of eventBuckets.entries()) {
    if (bucket.count > 0) out[key] = bucket.count;
  }
  return out;
}

export function restoreSponsorAnalyticsBuckets(data: Record<string, number> | undefined): void {
  eventBuckets.clear();
  if (!data) return;
  for (const [key, count] of Object.entries(data)) {
    if (typeof count === 'number' && count > 0) {
      eventBuckets.set(key, { count });
    }
  }
}

export function isValidSponsorPlacement(raw: unknown): raw is SponsorPlacement {
  return typeof raw === 'string' && VALID_PLACEMENTS.has(raw as SponsorPlacement);
}
