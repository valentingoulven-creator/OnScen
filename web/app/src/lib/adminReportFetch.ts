import { api } from './api';
import type {
  CloudflareUsageReport,
  DonationsSummaryReport,
  ProdSaasStatusReport,
  StatsOverviewResponse,
  VpsMetricsReport,
} from '../types';

export type AdminActivitySummary = Awaited<ReturnType<typeof api.getAnalyticsSummary>>;

export type AdminReportBundle = {
  generatedAt: string;
  scope: 'operational' | 'full';
  platform: StatsOverviewResponse;
  activity?: AdminActivitySummary;
  cloudflare?: CloudflareUsageReport;
  donations?: DonationsSummaryReport;
  vps?: VpsMetricsReport;
  prodSaas?: ProdSaasStatusReport;
  partialErrors: string[];
};

export async function fetchAdminReportBundle(
  token: string,
  includeDevSections: boolean,
  locale: string
): Promise<AdminReportBundle> {
  const platform = await api.getStatsOverview(token);
  const bundle: AdminReportBundle = {
    generatedAt: new Date().toISOString(),
    scope: includeDevSections ? 'full' : 'operational',
    platform,
    partialErrors: [],
  };

  if (!includeDevSections) return bundle;

  const settled = await Promise.allSettled([
    api.getAnalyticsSummary(token, { period: 'month', locale }),
    api.getCloudflareUsage(token),
    api.getDonationsSummary(token),
    api.getVpsMetrics(token),
    api.getProdSaasStatus(token),
  ]);

  const keys = ['activity', 'cloudflare', 'donations', 'vps', 'prodSaas'] as const;
  settled.forEach((result, i) => {
    const key = keys[i];
    if (result.status === 'fulfilled') {
      bundle[key] = result.value as never;
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      bundle.partialErrors.push(`${key}: ${msg}`);
    }
  });

  return bundle;
}
