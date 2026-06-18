import { db, type Gift } from '../models/schema';

export interface CreatorDashboardStats {
  tipsTotalCents: number;
  tipsCount: number;
  /** Pic cumulé de spectateurs (archives + live actif). */
  totalLivePeakViews: number;
  archivedLiveCount: number;
  activeLiveCount: number;
}

function isLiveDonationGift(gift: Gift): boolean {
  return gift.giftType === 'don' && Number.isFinite(gift.amount) && gift.amount > 0;
}

function isDonationGiftForHost(gift: Gift, hostId: string): boolean {
  if (!isLiveDonationGift(gift)) return false;
  const live = db.lives.get(gift.liveId);
  return live?.hostId === hostId;
}

/** Statistiques créateur pour le tableau de bord profil (pourboires PG + vues live). */
export function getCreatorDashboardStats(hostId: string): CreatorDashboardStats {
  let tipsTotalCents = 0;
  let tipsCount = 0;

  for (const gift of db.gifts) {
    if (!isDonationGiftForHost(gift, hostId)) continue;
    tipsTotalCents += Math.trunc(gift.amount) * 100;
    tipsCount += 1;
  }

  let totalLivePeakViews = 0;
  let archivedLiveCount = 0;
  let activeLiveCount = 0;

  for (const live of db.lives.values()) {
    if (live.hostId !== hostId) continue;
    const peak = live.peakViewersCount ?? live.viewersCount ?? 0;
    totalLivePeakViews += peak;
    if (live.isActive) activeLiveCount += 1;
    else archivedLiveCount += 1;
  }

  return {
    tipsTotalCents,
    tipsCount,
    totalLivePeakViews,
    archivedLiveCount,
    activeLiveCount,
  };
}
