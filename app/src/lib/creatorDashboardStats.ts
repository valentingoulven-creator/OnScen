export interface CreatorDashboardStats {
  tipsTotalCents: number;
  tipsCount: number;
  totalLivePeakViews: number;
  liveCount: number;
  archivedLiveCount: number;
  activeLiveCount: number;
  newSubscribers: number;
  topDonors: Array<{ name: string; amountCents: number }>;
}

export type CreatorStatsPeriod = {
  year: number;
  month?: number;
};

export function formatCreatorEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith('fr') ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function buildCreatorStatsYears(firstYear = 2024): number[] {
  const current = new Date().getFullYear();
  const start = Math.min(firstYear, current);
  const years: number[] = [];
  for (let y = current; y >= start; y -= 1) years.push(y);
  return years;
}

export function isCurrentCalendarMonth(year: number, month: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}
