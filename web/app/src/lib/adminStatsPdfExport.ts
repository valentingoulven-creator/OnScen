import type { TFunction } from 'i18next';
import type { StatsOverviewResponse } from '../types';
import { buildAdminFullReportPdfLabels } from './adminFullReportPdfLabels';
import { pdfSafeText } from './adminPdfCommon';
import { downloadAdminStatsPresentationPdf } from './adminStatsPresentationPdf';

export type AdminStatsPdfLabels = {
  documentTitle: string;
  generatedAt: string;
  sectionAudience: string;
  sectionContent: string;
  sectionAnalysis: string;
  sectionTopReels: string;
  sectionTopSalons: string;
  sectionTopLives: string;
  usersTotal: string;
  usersOnlineNow: string;
  usersActiveToday: string;
  usersActiveWeek: string;
  usersActiveMonth: string;
  totalReels: string;
  activeSalonsNow: string;
  totalSalonsCreated: string;
  activeLivesNow: string;
  totalLivesStarted: string;
  totalEvents: string;
  totalUpvotes: string;
  totalAlbums: string;
  totalCompositions: string;
  views: string;
  listeners: string;
  viewers: string;
  rank: string;
  footer: string;
};

function fmtEuro(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value));
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function fmtPct(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) + ' %');
}

function fmtNum(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale).format(value));
}

/** Points d’analyse déterministes à partir des agrégats (sans IA). */
export function buildAdminStatsAnalysis(
  data: StatsOverviewResponse,
  locale: string
): string[] {
  const fr = locale.toLowerCase().startsWith('fr');
  const { users, content, topReels, music, engagement, community, moderation, sponsors, analytics30d } = data;
  const lines: string[] = [];

  if (users.total === 0) {
    lines.push(
      fr
        ? 'Aucun utilisateur inscrit : la plateforme est en phase de démarrage ou base vide.'
        : 'No registered users: the platform is in early stage or the database is empty.'
    );
    return lines;
  }

  const onlinePct = pct(users.onlineNow, users.total);
  lines.push(
    fr
      ? `Présence simultanée : ${fmtNum(users.onlineNow, locale)} utilisateurs en ligne (${fmtPct(onlinePct, locale)} des inscrits).`
      : `Concurrent presence: ${fmtNum(users.onlineNow, locale)} users online (${fmtPct(onlinePct, locale)} of registered users).`
  );

  if (users.activeMonth > 0) {
    const dauOverMau = pct(users.activeToday, users.activeMonth);
    lines.push(
      fr
        ? `Engagement récent : ${fmtNum(users.activeToday, locale)} actifs aujourd'hui sur ${fmtNum(users.activeMonth, locale)} sur 30 jours (ratio jour/mois ≈ ${fmtPct(dauOverMau, locale)}).`
        : `Recent engagement: ${fmtNum(users.activeToday, locale)} active today out of ${fmtNum(users.activeMonth, locale)} in 30 days (day/month ratio ≈ ${fmtPct(dauOverMau, locale)}).`
    );
  }

  if (users.activeTodayTracked !== users.activeTodayLastSeen) {
    lines.push(
      fr
        ? `Double lecture DAU : ${fmtNum(users.activeTodayLastSeen, locale)} via lastSeenAt vs ${fmtNum(users.activeTodayTracked, locale)} via carte analytics (événements trackés).`
        : `Dual DAU read: ${fmtNum(users.activeTodayLastSeen, locale)} via lastSeenAt vs ${fmtNum(users.activeTodayTracked, locale)} via analytics map (tracked events).`
    );
  }

  const mon = data.monetization;
  if (mon.estimatedMrrCents > 0 || mon.tipsMonthCents > 0) {
    lines.push(
      fr
        ? `Monétisation : MRR total ${fmtEuro(mon.estimatedMrrCents / 100, locale)} (Stripe catalogue ${fmtEuro(mon.stripeMrrCents / 100, locale)}, reconstruit factures ${fmtEuro(mon.stripeReconciledMrrCents / 100, locale)}), revenu plateforme Stripe mois ${fmtEuro(mon.platformRevenueMonthStripeCents / 100, locale)}.`
        : `Monetization: total MRR ${fmtEuro(mon.estimatedMrrCents / 100, locale)} (Stripe catalog ${fmtEuro(mon.stripeMrrCents / 100, locale)}, invoice-rebuilt ${fmtEuro(mon.stripeReconciledMrrCents / 100, locale)}), platform Stripe revenue ${fmtEuro(mon.platformRevenueMonthStripeCents / 100, locale)}.`
    );
  }

  const liveSalon = content.activeLivesNow + content.activeSalonsNow;
  if (liveSalon === 0) {
    lines.push(
      fr
        ? 'Aucun salon ni live en direct à l’instant : opportunité de relancer des sessions écoutables ou des lives.'
        : 'No live salons or streams right now: consider scheduling listening sessions or lives.'
    );
  } else {
    lines.push(
      fr
        ? `Activité temps réel : ${fmtNum(content.activeSalonsNow, locale)} salon(s) et ${fmtNum(content.activeLivesNow, locale)} live(s) en cours (${fmtNum(liveSalon, locale)} sessions actives).`
        : `Real-time activity: ${fmtNum(content.activeSalonsNow, locale)} salon(s) and ${fmtNum(content.activeLivesNow, locale)} live stream(s) (${fmtNum(liveSalon, locale)} active sessions).`
    );
  }

  if (content.totalReels > 0 && topReels.length > 0) {
    const top = topReels[0];
    lines.push(
      fr
        ? `Reel le plus consulté : « ${top.title} » (@${top.authorName}) avec ${fmtNum(top.viewCount, locale)} vues — à mettre en avant si pertinent.`
        : `Top reel: "${top.title}" (@${top.authorName}) with ${fmtNum(top.viewCount, locale)} views — worth highlighting if relevant.`
    );
  }

  if (content.totalCompositions > 0 || content.totalAlbums > 0) {
    lines.push(
      fr
        ? `Catalogue musique : ${fmtNum(content.totalCompositions, locale)} morceau(x), ${fmtNum(content.totalAlbums, locale)} album(s) — upvotes sons ${fmtNum(music.compositionUpvotes, locale)}, événements ${fmtNum(music.eventUpvotes, locale)}.`
        : `Music catalog: ${fmtNum(content.totalCompositions, locale)} track(s), ${fmtNum(content.totalAlbums, locale)} album(s) — track upvotes ${fmtNum(music.compositionUpvotes, locale)}, events ${fmtNum(music.eventUpvotes, locale)}.`
    );
    if (music.compositionPlaysTotal > 0) {
      lines.push(
        fr
          ? `Écoutes morceaux : ${fmtNum(music.compositionPlaysTotal, locale)} au total, ${fmtNum(music.compositionPlays7d, locale)} sur 7 j (${fmtPct(pct(music.compositionPlays7d, music.compositionPlaysTotal), locale)} du cumul récent).`
          : `Track plays: ${fmtNum(music.compositionPlaysTotal, locale)} total, ${fmtNum(music.compositionPlays7d, locale)} in 7d (${fmtPct(pct(music.compositionPlays7d, music.compositionPlaysTotal), locale)} of recent volume).`
      );
    }
  }

  if (users.newLast30Days > 0) {
    lines.push(
      fr
        ? `Acquisition : ${fmtNum(users.newLast7Days, locale)} nouveaux sur 7 j, ${fmtNum(users.newLast30Days, locale)} sur 30 j ; ${fmtNum(users.inactive30Days, locale)} inactifs depuis 30 j (${fmtPct(pct(users.inactive30Days, users.total), locale)} des inscrits).`
        : `Acquisition: ${fmtNum(users.newLast7Days, locale)} new in 7d, ${fmtNum(users.newLast30Days, locale)} in 30d; ${fmtNum(users.inactive30Days, locale)} inactive 30d (${fmtPct(pct(users.inactive30Days, users.total), locale)} of registered).`
    );
  }

  if (engagement.followRelations > 0 || engagement.totalMatches > 0) {
    lines.push(
      fr
        ? `Graphe social : ${fmtNum(engagement.followRelations, locale)} relations « suit », ${fmtNum(engagement.totalMatches, locale)} matchs, ${fmtNum(engagement.directMessages, locale)} messages privés stockés.`
        : `Social graph: ${fmtNum(engagement.followRelations, locale)} follow edges, ${fmtNum(engagement.totalMatches, locale)} matches, ${fmtNum(engagement.directMessages, locale)} stored DMs.`
    );
  }

  const subs =
    engagement.activeCreatorSubscriptions + engagement.activePlatformSubscriptions;
  if (subs > 0) {
    lines.push(
      fr
        ? `Monétisation récurrente : ${fmtNum(engagement.activeCreatorSubscriptions, locale)} abo créateur(s) actif(s), ${fmtNum(engagement.activePlatformSubscriptions, locale)} OnScen+ actif(s).`
        : `Recurring revenue: ${fmtNum(engagement.activeCreatorSubscriptions, locale)} active creator sub(s), ${fmtNum(engagement.activePlatformSubscriptions, locale)} active OnScen+.`
    );
  }

  if (moderation.reportsPending > 0) {
    lines.push(
      fr
        ? `Modération : ${fmtNum(moderation.reportsPending, locale)} signalement(s) en attente sur ${fmtNum(moderation.reportsTotal, locale)} au total — prioriser le traitement.`
        : `Moderation: ${fmtNum(moderation.reportsPending, locale)} pending report(s) of ${fmtNum(moderation.reportsTotal, locale)} total — prioritize review.`
    );
  }

  if (community.supportOpen > 0) {
    lines.push(
      fr
        ? `Support : ${fmtNum(community.supportOpen, locale)} fil(s) ouvert(s) sur ${fmtNum(community.supportThreadsTotal, locale)} tickets.`
        : `Support: ${fmtNum(community.supportOpen, locale)} open thread(s) of ${fmtNum(community.supportThreadsTotal, locale)} tickets.`
    );
  }

  if (sponsors.activeNow > 0 || sponsors.impressions30d > 0) {
    lines.push(
      fr
        ? `Sponsoring : ${fmtNum(sponsors.activeNow, locale)} campagne(s) active(s) — ${fmtNum(sponsors.impressions30d, locale)} impressions / ${fmtNum(sponsors.clicks30d, locale)} clics (30 j, CTR ${fmtPct(sponsors.ctr30d, locale)}).`
        : `Sponsorship: ${fmtNum(sponsors.activeNow, locale)} active campaign(s) — ${fmtNum(sponsors.impressions30d, locale)} impressions / ${fmtNum(sponsors.clicks30d, locale)} clicks (30d, CTR ${fmtPct(sponsors.ctr30d, locale)}).`
    );
  }

  const matureCohorts = data.retention.cohorts.filter((c) => c.week1Mature && c.registered > 0);
  if (matureCohorts.length > 0) {
    const avgS1 =
      matureCohorts.reduce((a, c) => a + c.week1Rate, 0) / matureCohorts.length;
    const s4Rows = matureCohorts.filter((c) => c.week4Mature);
    const avgS4 =
      s4Rows.length > 0 ? s4Rows.reduce((a, c) => a + c.week4Rate, 0) / s4Rows.length : 0;
    const avgS1Login =
      matureCohorts.reduce((a, c) => a + c.week1RateLogin, 0) / matureCohorts.length;
    lines.push(
      fr
        ? `Rétention : S1 ${fmtPct(avgS1, locale)} (proxy) / ${fmtPct(avgS1Login, locale)} (login) ; S4 ${s4Rows.length > 0 ? fmtPct(avgS4, locale) : '—'}.`
        : `Retention: W1 ${fmtPct(avgS1, locale)} (proxy) / ${fmtPct(avgS1Login, locale)} (login); W4 ${s4Rows.length > 0 ? fmtPct(avgS4, locale) : '—'}.`
    );
  }

  if (analytics30d.logins > 0 || analytics30d.messagesSent > 0) {
    lines.push(
      fr
        ? `Compteurs 30 j (buckets) : ${fmtNum(analytics30d.logins, locale)} connexions, ${fmtNum(analytics30d.messagesSent, locale)} messages, ${fmtNum(analytics30d.reelsViewed, locale)} vues reels, ${fmtNum(analytics30d.livesStarted, locale)} lives, ${fmtNum(analytics30d.salonsCreated, locale)} salons.`
        : `30d counters (buckets): ${fmtNum(analytics30d.logins, locale)} logins, ${fmtNum(analytics30d.messagesSent, locale)} messages, ${fmtNum(analytics30d.reelsViewed, locale)} reel views, ${fmtNum(analytics30d.livesStarted, locale)} lives, ${fmtNum(analytics30d.salonsCreated, locale)} rooms.`
    );
  }

  if (content.totalEvents > 0) {
    lines.push(
      fr
        ? `${fmtNum(content.totalEvents, locale)} événement(s) publié(s) sur la carte / l’actu — le volet événementiel alimente la découverte locale.`
        : `${fmtNum(content.totalEvents, locale)} published event(s) on the map / feed — events drive local discovery.`
    );
  }

  return lines;
}

/** Export PDF stats plateforme (présentation type rapport). */
export async function downloadAdminStatsPdf(
  data: StatsOverviewResponse,
  t: TFunction,
  locale: string
): Promise<void> {
  const labels = buildAdminFullReportPdfLabels(t, data);
  await downloadAdminStatsPresentationPdf(
    data,
    { ...labels, footer: t('admin.stats.pdf.footer') },
    {
      title: t('admin.stats.pdf.documentTitle'),
      subtitle: t('admin.stats.pdf.coverSubtitle'),
      generatedAtLabel: t('admin.stats.pdf.generatedAt'),
      scopeLine: t('admin.stats.pdf.coverScopeOperational'),
      confidential: t('admin.stats.pdf.confidential'),
    },
    locale,
    {
      executiveTitle: t('admin.stats.pdf.sectionAnalysis'),
      maxAnalysisLines: 8,
    }
  );
}
