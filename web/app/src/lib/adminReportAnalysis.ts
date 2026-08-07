import type { AdminReportBundle } from './adminReportFetch';
import { buildAdminStatsAnalysis } from './adminStatsPdfExport';

function fmtNum(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function fmtEuro(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Synthèse exécutive : plateforme + coûts + activité (sections disponibles uniquement). */
export function buildExecutiveReportAnalysis(bundle: AdminReportBundle, locale: string): string[] {
  const lines = buildAdminStatsAnalysis(bundle.platform, locale);
  const fr = locale.toLowerCase().startsWith('fr');

  if (bundle.activity) {
    const { snapshot, series } = bundle.activity;
    const logins = sum(series.logins);
    const messages = sum(series.messagesSent);
    lines.push(
      fr
        ? `Activité (30 j) : ${fmtNum(logins, locale)} connexions, ${fmtNum(messages, locale)} messages, ${fmtNum(snapshot.totalMatches, locale)} matchs cumulés.`
        : `Activity (30d): ${fmtNum(logins, locale)} logins, ${fmtNum(messages, locale)} messages, ${fmtNum(snapshot.totalMatches, locale)} total matches.`
    );
  }

  if (bundle.cloudflare?.configured) {
    const eur = bundle.cloudflare.estimatedCostEur.total;
    lines.push(
      fr
        ? `Cloudflare Stream (période en cours) : coût estimé ${fmtEuro(eur, locale)} (${fmtNum(bundle.cloudflare.minutesDelivered, locale)} min livrées).`
        : `Cloudflare Stream (current period): estimated cost ${fmtEuro(eur, locale)} (${fmtNum(bundle.cloudflare.minutesDelivered, locale)} delivery minutes).`
    );
  }

  if (bundle.donations) {
    const all = bundle.donations.allTime;
    lines.push(
      fr
        ? `Pourboires live (tout temps) : ${fmtEuro(all.totalDonationsCents / 100, locale)} (${fmtNum(all.count, locale)} transactions, commission plateforme ${bundle.donations.platformFeePercent} %).`
        : `Live tips (all time): ${fmtEuro(all.totalDonationsCents / 100, locale)} (${fmtNum(all.count, locale)} txs, platform fee ${bundle.donations.platformFeePercent}%).`
    );
  }

  if (bundle.vps) {
    lines.push(
      fr
        ? `Infrastructure hôte : RAM ${bundle.vps.memory.usedPercent.toFixed(1)} %, latence DB ${fmtNum(bundle.vps.latencyMs, locale)} ms, uptime ${Math.floor(bundle.vps.uptimeSeconds / 3600)} h.`
        : `Host infrastructure: RAM ${bundle.vps.memory.usedPercent.toFixed(1)}%, DB latency ${fmtNum(bundle.vps.latencyMs, locale)} ms, uptime ${Math.floor(bundle.vps.uptimeSeconds / 3600)} h.`
    );
  }

  if (bundle.partialErrors.length > 0) {
    lines.push(
      fr
        ? `Sections partielles : certaines sources n'ont pas pu être chargées (${bundle.partialErrors.length}). Voir annexes.`
        : `Partial sections: some data sources failed to load (${bundle.partialErrors.length}). See appendix.`
    );
  }

  return lines;
}
