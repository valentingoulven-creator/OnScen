/** Préférences barre objectif sur la scène vidéo live (sync spectateurs). */
import type { LiveDonationGoalOverlay } from '../types';

export type { LiveDonationGoalOverlay };

export const DEFAULT_LIVE_GOAL_OVERLAY: LiveDonationGoalOverlay = {
  visibleToViewers: true,
  xPct: 4,
  yPct: 78,
};

export function clampGoalOverlayPosition(xPct: number, yPct: number): { xPct: number; yPct: number } {
  return {
    xPct: Math.min(72, Math.max(2, xPct)),
    yPct: Math.min(88, Math.max(8, yPct)),
  };
}

export function normalizeGoalOverlay(raw: Partial<LiveDonationGoalOverlay> | null | undefined): LiveDonationGoalOverlay {
  const base = DEFAULT_LIVE_GOAL_OVERLAY;
  if (!raw || typeof raw !== 'object') return { ...base };
  const pos = clampGoalOverlayPosition(
    Number.isFinite(raw.xPct) ? Number(raw.xPct) : base.xPct,
    Number.isFinite(raw.yPct) ? Number(raw.yPct) : base.yPct,
  );
  return {
    visibleToViewers: raw.visibleToViewers !== false,
    xPct: pos.xPct,
    yPct: pos.yPct,
  };
}
