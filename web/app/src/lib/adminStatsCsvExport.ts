import type { StatsOverviewResponse } from '../types';
import type { AdminReportBundle } from './adminReportFetch';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function row(section: string, key: string, value: string | number | boolean): string {
  return `${csvEscape(section)},${csvEscape(key)},${csvEscape(String(value))}`;
}

/** Export plat section/key/value pour BI (UTF-8, séparateur virgule). */
export function statsOverviewToCsv(data: StatsOverviewResponse): string {
  const lines: string[] = ['section,key,value'];
  const u = data.users;
  const c = data.content;
  const m = data.music;
  const e = data.engagement;
  const co = data.community;
  const mod = data.moderation;
  const sp = data.sponsors;
  const a = data.analytics30d;
  const mon = data.monetization;

  lines.push(row('meta', 'generatedAt', data.generatedAt));

  for (const [k, v] of Object.entries(u)) lines.push(row('users', k, v));
  for (const [k, v] of Object.entries(c)) lines.push(row('content', k, v));
  for (const [k, v] of Object.entries(m)) lines.push(row('music', k, v));
  for (const [k, v] of Object.entries(e)) lines.push(row('engagement', k, v));
  for (const [k, v] of Object.entries(co)) lines.push(row('community', k, v));
  lines.push(row('moderation', 'reportsTotal', mod.reportsTotal));
  lines.push(row('moderation', 'reportsPending', mod.reportsPending));

  for (const [k, v] of Object.entries(sp)) {
    if (k === 'activeByPlacement' || k === 'byPlacementMetrics' || k === 'topByImpressions30d') continue;
    lines.push(row('sponsors', k, v as number));
  }
  for (const [placement, count] of Object.entries(sp.activeByPlacement)) {
    lines.push(row('sponsors.activeByPlacement', placement, count));
  }
  for (const p of sp.byPlacementMetrics) {
    lines.push(
      row(
        'sponsors.placement30d',
        p.placement,
        `impressions=${p.impressions30d};clicks=${p.clicks30d};ctr=${p.ctr30d}`
      )
    );
  }
  for (const t of sp.topByImpressions30d) {
    lines.push(
      row(
        'sponsors.top30d',
        t.sponsorName,
        `id=${t.sponsorId};imp=${t.impressions30d};clk=${t.clicks30d};ctr=${t.ctr30d}`
      )
    );
  }

  for (const [k, v] of Object.entries(a)) lines.push(row('analytics30d', k, v));
  for (const [k, v] of Object.entries(mon)) lines.push(row('monetization', k, v));

  for (const cohort of data.retention.cohorts) {
    lines.push(
      row(
        'retention',
        cohort.cohortWeek,
        `registered=${cohort.registered};s1=${cohort.week1Mature ? cohort.week1Rate : 'na'};s4=${cohort.week4Mature ? cohort.week4Rate : 'na'};s1login=${cohort.week1Mature ? cohort.week1RateLogin : 'na'};s4login=${cohort.week4Mature ? cohort.week4RateLogin : 'na'}`
      )
    );
  }

  for (const [i, reel] of data.topReels.entries()) {
    lines.push(row('topReels', String(i + 1), `${reel.title};views=${reel.viewCount}`));
  }

  return `${lines.join('\n')}\n`;
}

/** CSV plateforme + sections Dev (activité, coûts, erreurs partielles). */
export function adminReportBundleToCsv(bundle: AdminReportBundle): string {
  let csv = statsOverviewToCsv(bundle.platform);
  const append = (section: string, key: string, value: string | number | boolean) => {
    csv += row(section, key, value);
  };
  append('meta', 'reportScope', bundle.scope);
  append('meta', 'bundleGeneratedAt', bundle.generatedAt);

  if (bundle.activity) {
    const snap = bundle.activity.snapshot;
    for (const [k, v] of Object.entries(snap)) {
      append('dev.activity.snapshot', k, v as number);
    }
  }
  if (bundle.cloudflare?.configured) {
    append('dev.cloudflare', 'minutesDelivered', bundle.cloudflare.minutesDelivered);
    append('dev.cloudflare', 'estimatedCostEur', bundle.cloudflare.estimatedCostEur.total);
  }
  if (bundle.donations) {
    append('dev.donations', 'allTimeCents', bundle.donations.allTime.totalDonationsCents);
    append('dev.donations', 'monthCents', bundle.donations.thisMonth.totalDonationsCents);
  }
  if (bundle.vps) {
    append('dev.vps', 'memoryUsedPercent', bundle.vps.memory.usedPercent);
    append('dev.vps', 'latencyMs', bundle.vps.latencyMs);
  }
  for (const err of bundle.partialErrors) {
    append('dev.errors', 'partial', err);
  }
  return csv;
}

export function downloadAdminStatsCsv(data: StatsOverviewResponse, locale: string): void {
  triggerCsvDownload(statsOverviewToCsv(data), locale, data.generatedAt, 'stats');
}

export function downloadAdminReportCsv(bundle: AdminReportBundle, locale: string): void {
  triggerCsvDownload(
    adminReportBundleToCsv(bundle),
    locale,
    bundle.generatedAt,
    bundle.scope === 'full' ? 'report-full' : 'stats'
  );
}

function triggerCsvDownload(csv: string, locale: string, generatedAt: string, prefix: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(generatedAt).toISOString().slice(0, 10);
  const lang = locale.slice(0, 2);
  const a = document.createElement('a');
  a.href = url;
  a.download = `onscen-${prefix}-${lang}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
