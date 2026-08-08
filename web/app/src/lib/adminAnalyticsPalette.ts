/**
 * Palette dédiée à la vue analytique avancée — 3 accents max (violet, rose,
 * cyan — cohérents avec la charte OnScen) + échelle de gris. Volontairement
 * distincte des couleurs par défaut Tailwind/Chart.js.
 */
export const ANALYTICS_ACCENTS = ['#A78BFA', '#F472B6', '#38BDF8'] as const;

/** Cycle sur les 3 accents avec variation d'opacité pour les séries multiples (>3). */
export function getAnalyticsSeriesColor(index: number): string {
  const base = ANALYTICS_ACCENTS[index % ANALYTICS_ACCENTS.length];
  const round = Math.floor(index / ANALYTICS_ACCENTS.length);
  if (round === 0) return base;
  // Variante plus sombre pour les séries au-delà du 3e cycle (rare en pratique).
  return `${base}CC`;
}
