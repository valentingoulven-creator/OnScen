/**
 * Génération d'insights textuels automatiques à partir du dataset mocké
 * (Admin ▸ Analytics ▸ Aperçu avancé). Utilisé dans le dashboard et le PDF.
 *
 * Logique volontairement simple et déterministe (deltas période vs période
 * précédente + seuils) — pas d'appel LLM, pour rester reproductible et
 * auditable dans un rapport interne.
 */
import type { AnalyticsDailyPoint, AnalyticsPeriodKey } from '../data/mockAnalyticsDashboard';
import { avg, pctDelta, sum } from '../data/mockAnalyticsDashboard';
import { MOCK_TOP_VIRAL_CONTENT } from '../data/mockAnalyticsDashboard';
import { fmtNum } from './adminPdfCommon';

function periodLabelFr(period: AnalyticsPeriodKey): string {
  if (period === '7d') return '7 derniers jours';
  if (period === '30d') return '30 derniers jours';
  if (period === '3m') return '3 derniers mois';
  return '12 derniers mois';
}

export function buildGrowthInsights(
  current: AnalyticsDailyPoint[],
  previous: AnalyticsDailyPoint[],
  period: AnalyticsPeriodKey
): string[] {
  const pLabel = periodLabelFr(period);
  const mauNow = current[current.length - 1]?.mau ?? 0;
  const mauPrev = previous[previous.length - 1]?.mau ?? mauNow;
  const signupsDelta = pctDelta(sum(current.map((p) => p.newSignups)), sum(previous.map((p) => p.newSignups)));
  const d7Now = avg(current.map((p) => p.retentionD7Pct));
  const d7Prev = avg(previous.map((p) => p.retentionD7Pct));
  const churnNow = avg(current.map((p) => p.churnPct));

  const lines: string[] = [];
  lines.push(
    `Les utilisateurs mensuels actifs atteignent ${fmtNum(mauNow, 'fr-FR')} (${pctDelta(mauNow, mauPrev) >= 0 ? '+' : ''}${pctDelta(mauNow, mauPrev)}% vs période précédente équivalente).`
  );
  lines.push(
    `Les nouvelles inscriptions ont ${signupsDelta >= 0 ? 'progressé' : 'reculé'} de ${Math.abs(signupsDelta)}% sur les ${pLabel}.`
  );
  lines.push(
    `La rétention J7 moyenne est de ${d7Now.toFixed(1)}% (${d7Now >= d7Prev ? '+' : ''}${(d7Now - d7Prev).toFixed(1)} pt vs période précédente).`
  );
  lines.push(`Le taux de churn moyen s'établit à ${churnNow.toFixed(1)}%.`);
  return lines;
}

export function buildEngagementInsights(current: AnalyticsDailyPoint[], previous: AnalyticsDailyPoint[]): string[] {
  const sessionNow = avg(current.map((p) => p.avgSessionMinutes));
  const sessionPrev = avg(previous.map((p) => p.avgSessionMinutes));
  const postsNow = sum(current.map((p) => p.postsPhoto + p.postsVideo + p.postsReels + p.postsStories));
  const likesNow = sum(current.map((p) => p.likes));
  const messagesNow = sum(current.map((p) => p.messagesSent));

  return [
    `La durée moyenne de session est de ${sessionNow.toFixed(1)} min (${sessionNow >= sessionPrev ? '+' : ''}${(sessionNow - sessionPrev).toFixed(1)} min vs période précédente).`,
    `${fmtNum(postsNow, 'fr-FR')} publications créées (photo, vidéo, reels, stories cumulés) sur la période.`,
    `${fmtNum(likesNow, 'fr-FR')} likes et ${fmtNum(messagesNow, 'fr-FR')} messages envoyés — l'engagement social reste le principal moteur d'usage.`,
  ];
}

export function buildContentInsights(current: AnalyticsDailyPoint[]): string[] {
  const watchNow = avg(current.map((p) => p.avgWatchSeconds));
  const completionNow = avg(current.map((p) => p.completionRatePct));
  const top = MOCK_TOP_VIRAL_CONTENT[0];
  return [
    `La durée moyenne de visionnage est de ${watchNow.toFixed(0)}s, pour un taux de complétion de ${completionNow.toFixed(1)}%.`,
    `Le contenu le plus viral de la période est « ${top.title} » avec ${fmtNum(top.views, 'fr-FR')} vues (${top.engagementPct}% d'engagement).`,
    `Le format reel concentre la majorité des vues virales — à privilégier dans la stratégie de mise en avant éditoriale.`,
  ];
}

export function buildMonetizationInsights(current: AnalyticsDailyPoint[], previous: AnalyticsDailyPoint[]): string[] {
  const adRevNow = sum(current.map((p) => p.adRevenueEur));
  const adRevPrev = sum(previous.map((p) => p.adRevenueEur));
  const creatorRevNow = sum(current.map((p) => p.creatorRevenueEur));
  const ctrNow = avg(current.map((p) => p.ctrPct));

  return [
    `Les revenus publicitaires estimés atteignent ${fmtNum(Math.round(adRevNow), 'fr-FR')} € (${pctDelta(adRevNow, adRevPrev) >= 0 ? '+' : ''}${pctDelta(adRevNow, adRevPrev)}% vs période précédente).`,
    `Le CTR moyen des formats sponsorisés est de ${ctrNow.toFixed(2)}%.`,
    `Les créateurs ont généré collectivement ${fmtNum(Math.round(creatorRevNow), 'fr-FR')} € de revenus sur la période.`,
  ];
}

export function buildTechnicalInsights(current: AnalyticsDailyPoint[]): string[] {
  const loadNow = avg(current.map((p) => p.avgLoadTimeMs));
  const crashNow = avg(current.map((p) => p.crashRatePct));
  const ratingNow = avg(current.map((p) => p.storeRating));
  return [
    `Le temps de chargement moyen est de ${loadNow.toFixed(0)} ms.`,
    `Le taux de crash moyen est de ${crashNow.toFixed(2)}%, ${crashNow < 0.5 ? 'un niveau sain' : 'à surveiller de près'}.`,
    `La note moyenne sur les stores est de ${ratingNow.toFixed(2)}/5.`,
  ];
}

export function buildAcquisitionInsights(current: AnalyticsDailyPoint[]): string[] {
  const cacNow = avg(current.map((p) => p.cacEur));
  const convNow = avg(current.map((p) => p.conversionRatePct));
  const organicNow = avg(current.map((p) => p.acquisitionOrganicPct));
  return [
    `Le coût d'acquisition moyen (CAC) est de ${cacNow.toFixed(2)} € par utilisateur.`,
    `Le taux de conversion moyen est de ${convNow.toFixed(1)}%.`,
    `L'acquisition organique représente ${organicNow.toFixed(0)}% des nouveaux utilisateurs — canal dominant devant l'acquisition payante.`,
  ];
}

export function buildExecutiveInsights(
  current: AnalyticsDailyPoint[],
  previous: AnalyticsDailyPoint[],
  period: AnalyticsPeriodKey
): string[] {
  return [
    ...buildGrowthInsights(current, previous, period).slice(0, 2),
    ...buildEngagementInsights(current, previous).slice(0, 1),
    ...buildMonetizationInsights(current, previous).slice(0, 1),
    ...buildTechnicalInsights(current).slice(0, 1),
  ];
}
