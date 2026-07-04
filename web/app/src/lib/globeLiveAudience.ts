import type { Live, Salon } from '../types';
import { resolveLiveMarkerCountryCode, salonMarkerCountryCode } from './liveCountry';

export function getLiveAudienceCount(live: Live): number {
  return Math.max(0, Number(live.viewersCount) || 0);
}

export function getLiveSalonAudienceCount(salon: Salon): number {
  if (!salon.isLive) return 0;
  return Math.max(0, Number(salon.listenersCount) || 0);
}

/** Moyenne d'audience par code pays (ISO-2) sur l'ensemble des lives / salons live visibles. */
export function computeNationalLiveAudienceAverages(
  lives: Live[],
  liveSalons: Salon[]
): Map<string, number> {
  const buckets = new Map<string, number[]>();

  const push = (code: string | null, count: number) => {
    if (!code) return;
    const list = buckets.get(code) ?? [];
    list.push(count);
    buckets.set(code, list);
  };

  for (const live of lives) {
    push(resolveLiveMarkerCountryCode(live), getLiveAudienceCount(live));
  }
  for (const salon of liveSalons) {
    push(salonMarkerCountryCode(salon), getLiveSalonAudienceCount(salon));
  }

  const averages = new Map<string, number>();
  for (const [code, counts] of buckets) {
    if (counts.length === 0) continue;
    averages.set(code, counts.reduce((sum, n) => sum + n, 0) / counts.length);
  }
  return averages;
}

export interface GlobeLiveAudienceFilterResult {
  lives: Live[];
  liveSalons: Salon[];
  nationalAverages: Map<string, number>;
  totalBeforeFilter: number;
}

/** Ne conserve que les marqueurs strictement au-dessus de la moyenne nationale de leur pays. */
export function filterGlobeLiveMarkersAboveAverageAudience(
  lives: Live[],
  salons: Salon[]
): GlobeLiveAudienceFilterResult {
  const liveSalons = salons.filter((s) => s.isLive);
  const totalBeforeFilter = lives.length + liveSalons.length;
  const nationalAverages = computeNationalLiveAudienceAverages(lives, liveSalons);

  const isAboveNationalAverage = (code: string | null, count: number): boolean => {
    if (!code) return false;
    const average = nationalAverages.get(code);
    if (average == null) return false;
    return count > average;
  };

  return {
    lives: lives.filter((l) =>
      isAboveNationalAverage(resolveLiveMarkerCountryCode(l), getLiveAudienceCount(l))
    ),
    liveSalons: liveSalons.filter((s) =>
      isAboveNationalAverage(salonMarkerCountryCode(s), getLiveSalonAudienceCount(s))
    ),
    nationalAverages,
    totalBeforeFilter,
  };
}

export function applyGlobeLiveAudienceFilterToSalons(
  salons: Salon[],
  filteredLiveSalons: Salon[]
): Salon[] {
  const nonLive = salons.filter((s) => !s.isLive);
  return [...nonLive, ...filteredLiveSalons];
}
