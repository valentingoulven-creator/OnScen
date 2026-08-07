/**
 * Jeu de données MOCKÉ — Vue analytique avancée (onglet Admin ▸ Analytics ▸ Aperçu avancé).
 *
 * ⚠️ Toutes les valeurs ci-dessous sont générées (déterministes, seed fixe) et NE
 * PROVIENNENT PAS de la base Soundy. Elles couvrent des catégories non encore
 * instrumentées en prod (sessions, watch-time, CAC, crash rate, store rating…).
 *
 * Remplacement par une vraie API : exposer un endpoint backend retournant la même
 * forme que `AnalyticsDailyPoint[]` (voir `commun/backend/src/lib/statsOverview.ts`
 * pour le pattern d'agrégation déjà en place côté plateforme réelle) puis remplacer
 * `getMockAnalyticsDailyPoints()` par un appel `api.getAnalyticsDashboard(...)`.
 *
 * Les métriques déjà réelles dans Soundy (audience, contenu, monétisation Stripe,
 * sponsors) restent visibles telles quelles dans les sous-onglets « Plateforme » et
 * « Activité » — ce module ne les duplique pas.
 */

export type AnalyticsDailyPoint = {
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  // Croissance
  newSignups: number;
  dau: number;
  wau: number;
  mau: number;
  retentionD1Pct: number;
  retentionD7Pct: number;
  retentionD30Pct: number;
  churnPct: number;
  // Engagement
  avgSessionMinutes: number;
  sessionsPerUser: number;
  postsPhoto: number;
  postsVideo: number;
  postsReels: number;
  postsStories: number;
  likes: number;
  comments: number;
  shares: number;
  messagesSent: number;
  // Contenu
  avgWatchSeconds: number;
  completionRatePct: number;
  // Monétisation (ads — distinct des abonnements/pourboires réels Stripe)
  adRevenueEur: number;
  cpmEur: number;
  cpcEur: number;
  ctrPct: number;
  creatorRevenueEur: number;
  // Technique
  avgLoadTimeMs: number;
  crashRatePct: number;
  storeRating: number;
  // Acquisition
  cacEur: number;
  conversionRatePct: number;
  acquisitionOrganicPct: number;
  acquisitionPaidPct: number;
  acquisitionReferralPct: number;
};

export type AnalyticsPeriodKey = '7d' | '30d' | '3m' | '12m';

export const ANALYTICS_PERIOD_DAYS: Record<AnalyticsPeriodKey, number> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '12m': 365,
};

export type GeoSlice = { code: string; label: string; pct: number };
export type AgeSlice = { bracket: string; pct: number };
export type ViralContentItem = {
  id: string;
  title: string;
  type: 'reel' | 'salon' | 'live';
  views: number;
  engagementPct: number;
};

/** Répartition géographique — snapshot courant (mock, stable). */
export const MOCK_GEO_BREAKDOWN: GeoSlice[] = [
  { code: 'FR', label: 'France', pct: 54 },
  { code: 'BE', label: 'Belgique', pct: 12 },
  { code: 'CH', label: 'Suisse', pct: 9 },
  { code: 'CA', label: 'Canada', pct: 8 },
  { code: 'MA', label: 'Maroc', pct: 7 },
  { code: 'OTHER', label: 'Autres', pct: 10 },
];

/** Répartition par âge — snapshot courant (mock, stable). */
export const MOCK_AGE_BREAKDOWN: AgeSlice[] = [
  { bracket: '13-17', pct: 9 },
  { bracket: '18-24', pct: 38 },
  { bracket: '25-34', pct: 31 },
  { bracket: '35-44', pct: 14 },
  { bracket: '45+', pct: 8 },
];

export type EventCategorySlice = { key: 'music' | 'dance' | 'humor' | 'other'; pct: number };

/** Répartition des événements par catégorie — snapshot courant (mock, stable). */
export const MOCK_EVENT_CATEGORY_BREAKDOWN: EventCategorySlice[] = [
  { key: 'music', pct: 46 },
  { key: 'dance', pct: 27 },
  { key: 'humor', pct: 15 },
  { key: 'other', pct: 12 },
];

export const MOCK_TOP_VIRAL_CONTENT: ViralContentItem[] = [
  { id: 'v1', title: 'Reel — Session live acoustique', type: 'reel', views: 48210, engagementPct: 14.2 },
  { id: 'v2', title: 'Salon — Découverte Pop FR', type: 'salon', views: 31890, engagementPct: 11.6 },
  { id: 'v3', title: 'Reel — Cover piano virale', type: 'reel', views: 27650, engagementPct: 10.9 },
  { id: 'v4', title: 'Live — Freestyle nocturne', type: 'live', views: 21430, engagementPct: 9.4 },
  { id: 'v5', title: 'Reel — Duo guitare/voix', type: 'reel', views: 18990, engagementPct: 8.7 },
];

// ── Générateur déterministe (mulberry32) — même seed à chaque rendu ─────────
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

let cachedPoints: AnalyticsDailyPoint[] | null = null;

/** Génère (une seule fois, mise en cache) 365 jours de données mockées cohérentes. */
export function getMockAnalyticsDailyPoints(): AnalyticsDailyPoint[] {
  if (cachedPoints) return cachedPoints;
  const rand = mulberry32(20260807);
  const days = 365;
  const points: AnalyticsDailyPoint[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let mauBase = 9200;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const t = (days - i) / days; // progression 0→1 sur l'année
    const seasonal = Math.sin((t * Math.PI * 2 * 3) + i * 0.05) * 0.5 + 0.5;
    const weekday = d.getUTCDay();
    const weekendDampen = weekday === 0 || weekday === 6 ? 0.86 : 1;
    const noise = (rand() - 0.5) * 2;

    // Croissance — tendance haussière légère + saisonnalité + bruit
    mauBase += 6 + seasonal * 8 + noise * 4;
    const dauBase = mauBase * (0.16 + seasonal * 0.03) * weekendDampen;
    const dau = Math.round(clamp(dauBase, 400, mauBase));
    const wau = Math.round(clamp(dau * (2.7 + noise * 0.15), dau, mauBase));
    const mau = Math.round(mauBase);
    const newSignups = Math.round(clamp(28 + seasonal * 22 + noise * 10, 4, 140));

    points.push({
      date: d.toISOString().slice(0, 10),
      newSignups,
      dau,
      wau,
      mau,
      retentionD1Pct: Number(clamp(46 + seasonal * 6 + noise * 3, 30, 68).toFixed(1)),
      retentionD7Pct: Number(clamp(24 + seasonal * 5 + noise * 2.5, 12, 42).toFixed(1)),
      retentionD30Pct: Number(clamp(11 + seasonal * 3 + noise * 1.5, 4, 24).toFixed(1)),
      churnPct: Number(clamp(6.5 - seasonal * 1.5 + Math.abs(noise) * 0.8, 2, 12).toFixed(1)),
      avgSessionMinutes: Number(clamp(8.5 + seasonal * 2.5 + noise * 1, 4, 18).toFixed(1)),
      sessionsPerUser: Number(clamp(2.4 + seasonal * 0.6 + noise * 0.3, 1, 5).toFixed(2)),
      postsPhoto: Math.round(clamp(dau * 0.04 + noise * 6, 5, 400)),
      postsVideo: Math.round(clamp(dau * 0.02 + noise * 3, 2, 250)),
      postsReels: Math.round(clamp(dau * 0.03 + noise * 5, 3, 320)),
      postsStories: Math.round(clamp(dau * 0.06 + noise * 8, 8, 500)),
      likes: Math.round(clamp(dau * 3.2 + noise * 120, 200, 20000)),
      comments: Math.round(clamp(dau * 0.9 + noise * 40, 40, 6000)),
      shares: Math.round(clamp(dau * 0.35 + noise * 20, 10, 2500)),
      messagesSent: Math.round(clamp(dau * 1.8 + noise * 90, 100, 12000)),
      avgWatchSeconds: Math.round(clamp(64 + seasonal * 18 + noise * 8, 25, 140)),
      completionRatePct: Number(clamp(38 + seasonal * 10 + noise * 4, 18, 72).toFixed(1)),
      adRevenueEur: Number(clamp(180 + seasonal * 70 + noise * 30, 40, 520).toFixed(2)),
      cpmEur: Number(clamp(2.8 + seasonal * 0.6 + noise * 0.3, 1.2, 5.5).toFixed(2)),
      cpcEur: Number(clamp(0.32 + seasonal * 0.08 + noise * 0.04, 0.12, 0.68).toFixed(2)),
      ctrPct: Number(clamp(1.4 + seasonal * 0.5 + noise * 0.2, 0.4, 3.2).toFixed(2)),
      creatorRevenueEur: Number(clamp(95 + seasonal * 45 + noise * 20, 20, 340).toFixed(2)),
      avgLoadTimeMs: Math.round(clamp(1180 - seasonal * 150 + Math.abs(noise) * 80, 650, 1900)),
      crashRatePct: Number(clamp(0.42 - seasonal * 0.12 + Math.abs(noise) * 0.15, 0.05, 1.1).toFixed(2)),
      storeRating: Number(clamp(4.3 + seasonal * 0.15 + noise * 0.05, 3.6, 4.9).toFixed(2)),
      cacEur: Number(clamp(3.6 - seasonal * 0.6 + Math.abs(noise) * 0.5, 1.5, 6.5).toFixed(2)),
      conversionRatePct: Number(clamp(4.2 + seasonal * 1.1 + noise * 0.6, 1.5, 8.5).toFixed(2)),
      acquisitionOrganicPct: Number(clamp(52 + seasonal * 6 - noise * 3, 35, 68).toFixed(1)),
      acquisitionPaidPct: Number(clamp(31 - seasonal * 4 + noise * 2, 15, 45).toFixed(1)),
      acquisitionReferralPct: Number(clamp(17 - seasonal * 2 + noise * 1.5, 8, 28).toFixed(1)),
    });
  }
  cachedPoints = points;
  return points;
}

/** Retourne le slice [période sélectionnée] + le slice équivalent immédiatement précédent (pour deltas). */
export function getMockAnalyticsPeriodSlices(period: AnalyticsPeriodKey): {
  current: AnalyticsDailyPoint[];
  previous: AnalyticsDailyPoint[];
} {
  const all = getMockAnalyticsDailyPoints();
  const n = ANALYTICS_PERIOD_DAYS[period];
  const current = all.slice(Math.max(0, all.length - n));
  const previous = all.slice(Math.max(0, all.length - n * 2), Math.max(0, all.length - n));
  return { current, previous };
}

/** Regroupe une série journalière en N buckets max (moyenne/somme) pour lisibilité des graphiques. */
export function bucketizeDailyPoints<T extends number>(
  values: T[],
  labels: string[],
  maxBuckets = 12,
  mode: 'sum' | 'avg' = 'sum'
): { labels: string[]; values: number[] } {
  if (values.length <= maxBuckets) return { labels, values };
  const bucketSize = Math.ceil(values.length / maxBuckets);
  const outLabels: string[] = [];
  const outValues: number[] = [];
  for (let i = 0; i < values.length; i += bucketSize) {
    const chunk = values.slice(i, i + bucketSize);
    const sum = chunk.reduce((a, b) => a + b, 0);
    outValues.push(mode === 'avg' ? Number((sum / chunk.length).toFixed(2)) : sum);
    outLabels.push(labels[i]);
  }
  return { labels: outLabels, values: outValues };
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function avg(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
