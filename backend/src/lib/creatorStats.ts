import { db, type Gift } from '../models/schema';

export interface CreatorDashboardStats {
  tipsTotalCents: number;
  tipsCount: number;
  /** Pic cumulé de spectateurs (lives de la période). */
  totalLivePeakViews: number;
  liveCount: number;
  archivedLiveCount: number;
  activeLiveCount: number;
  newSubscribers: number;
  topDonors: Array<{ name: string; amountCents: number }>;
}

export type CreatorStatsPeriodQuery = {
  year?: number;
  month?: number;
};

function isLiveDonationGift(gift: Gift): boolean {
  return gift.giftType === 'don' && Number.isFinite(gift.amount) && gift.amount > 0;
}

function isDonationGiftForHost(gift: Gift, hostId: string): boolean {
  if (!isLiveDonationGift(gift)) return false;
  const live = db.lives.get(gift.liveId);
  return live?.hostId === hostId;
}

function resolvePeriodRange(query?: CreatorStatsPeriodQuery): { start: number; end: number } | null {
  if (query?.year === undefined || !Number.isFinite(query.year)) return null;
  const year = Math.trunc(query.year);
  if (year < 2000 || year > 2100) return null;
  const month =
    query.month !== undefined && Number.isFinite(query.month)
      ? Math.trunc(query.month)
      : undefined;
  if (month !== undefined && (month < 1 || month > 12)) return null;
  if (month !== undefined) {
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0).getTime(),
      end: new Date(year, month, 0, 23, 59, 59, 999).getTime(),
    };
  }
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0).getTime(),
    end: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
  };
}

function inPeriod(ts: number, range: { start: number; end: number } | null): boolean {
  if (!range) return true;
  return ts >= range.start && ts <= range.end;
}

/** Statistiques créateur pour le tableau de bord (pourboires, vues live, abonnés). */
export function getCreatorDashboardStats(
  hostId: string,
  query?: CreatorStatsPeriodQuery,
): CreatorDashboardStats {
  const range = resolvePeriodRange(query);
  let tipsTotalCents = 0;
  let tipsCount = 0;
  const donorTotals = new Map<string, number>();

  for (const gift of db.gifts) {
    if (!isDonationGiftForHost(gift, hostId)) continue;
    if (!inPeriod(gift.timestamp, range)) continue;
    const cents = Math.trunc(gift.amount) * 100;
    tipsTotalCents += cents;
    tipsCount += 1;
    donorTotals.set(gift.senderName, (donorTotals.get(gift.senderName) ?? 0) + cents);
  }

  let totalLivePeakViews = 0;
  let archivedLiveCount = 0;
  let activeLiveCount = 0;

  for (const live of db.lives.values()) {
    if (live.hostId !== hostId) continue;
    if (!inPeriod(live.startedAt, range)) continue;
    const peak = live.peakViewersCount ?? live.viewersCount ?? 0;
    totalLivePeakViews += peak;
    if (live.isActive) activeLiveCount += 1;
    else archivedLiveCount += 1;
  }

  let newSubscribers = 0;
  for (const sub of db.creatorSubscriptions) {
    if (sub.creatorId !== hostId) continue;
    if (!inPeriod(sub.createdAt, range)) continue;
    newSubscribers += 1;
  }

  const topDonors = [...donorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amountCents]) => ({ name, amountCents }));

  return {
    tipsTotalCents,
    tipsCount,
    totalLivePeakViews,
    liveCount: archivedLiveCount + activeLiveCount,
    archivedLiveCount,
    activeLiveCount,
    newSubscribers,
    topDonors,
  };
}
