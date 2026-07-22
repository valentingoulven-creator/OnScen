import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { CloudflareUsageReport, DonationsSummaryPeriod, DonationsSummaryReport, ProdSaasAlert, ProdSaasServiceReport, ProdSaasServiceStatus, ProdSaasStatusReport } from '../types';
import { LegalDocumentView } from '../components/LegalDocumentView';
import type { LegalKey } from '../content/legal';

type CostsSubTab = 'summary' | 'pricing';

/** Valeurs indicatives — voir docs/COUT-APPLICATION.md §2 */
const FIXED_COSTS = [
  { label: 'VPS Scaleway (DEV1-S)', amount: '~8–12 €', note: '51.159.164.100 — /opt/soundy' },
  { label: 'PostgreSQL Scaleway (DB-DEV-S)', amount: '~15 €', note: 'Base managée Paris, sslmode=require' },
  { label: 'Gmail Pro (Google Workspace)', amount: '16,90 €', note: 'Messagerie équipe @getsoundy.com' },
  { label: 'Domaine getsoundy.com', amount: '~1 €', note: 'Renouvellement annuel ~10–15 €' },
  { label: 'Coturn TURN', amount: '0 €', note: 'Sur le même VPS (port 3478)' },
  { label: 'Caddy + PM2', amount: '0 €', note: 'Inclus VPS' },
];

const LIVEKIT_TIERS = [
  { tier: 'Build (gratuit)', price: '0 $/mois', limits: '100 connexions simultanées, 5000 min/mois' },
  { tier: 'Ship', price: '50 $/mois', limits: 'Au-delà du quota Build' },
];

const CF_PRICING = [
  { item: 'Ingest RTMP / WHIP', price: 'Gratuit' },
  { item: 'Minutes livrées (HLS/DASH)', price: '1 $ / 1000 min' },
  { item: 'Stockage vidéo', price: '5 $ / 1000 min stockées / mois' },
  { item: 'Abonnement fixe', price: '0 $/mois (pay-as-you-go)' },
];

const SCALE_COMPARISON = [
  {
    scenario: 'Startup',
    detail: '10 lives/mois × 20 spectateurs × 1 h',
    mesh: '0 € (limite ~30)',
    livekit: '0 $ (Build)',
    cloudflare: '~12 $',
    hybrid: '~12 $',
  },
  {
    scenario: 'Croissance',
    detail: '50 lives × 200 spectateurs × 1 h',
    mesh: 'Non viable',
    livekit: '0–50 $',
    cloudflare: '~500 $',
    hybrid: '~500 $',
  },
  {
    scenario: 'Scale',
    detail: '100 lives × 500 spectateurs × 1 h',
    mesh: 'Non viable',
    livekit: '50 $+ (Ship)',
    cloudflare: '~2500 $',
    hybrid: '~2550 $',
  },
];

function formatNumber(n: number, locale: string): string {
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function formatEuroFromCents(cents: number, locale: string): string {
  return `${formatNumber(cents / 100, locale)} €`;
}

function DonationsPeriodStats({
  title,
  period,
  locale,
  t,
}: {
  title: string;
  period: DonationsSummaryPeriod;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <StatBox
          label={t('admin.costs.donationsTotal')}
          value={formatEuroFromCents(period.totalDonationsCents, locale)}
          sub={t('admin.costs.donationsCount', { count: period.count })}
        />
        <StatBox
          label={t('admin.costs.donationsPlatform')}
          value={formatEuroFromCents(period.platformFeesCents, locale)}
        />
        <StatBox
          label={t('admin.costs.donationsCreator')}
          value={formatEuroFromCents(period.creatorPayoutsCents, locale)}
        />
        <StatBox
          label="Stripe / msdev"
          value={`${period.stripeCount} / ${period.simulationCount}`}
          sub={
            period.simulationCount > 0
              ? t('admin.costs.donationsSimulationNote', { count: period.simulationCount })
              : period.stripeCount > 0
                ? t('admin.costs.donationsStripeNote', { count: period.stripeCount })
                : undefined
          }
        />
      </div>
    </div>
  );
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[320px]">
        <thead>
          <tr className="border-b border-[#2d2d3d]">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1a1a26] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-2 text-gray-300 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#1a1a26] border border-[#2d2d3d] rounded-xl p-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-purple-300 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function CostsSubTabBar({
  subTab,
  onChange,
  t,
}: {
  subTab: CostsSubTab;
  onChange: (tab: CostsSubTab) => void;
  t: (key: string) => string;
}) {
  const items: { id: CostsSubTab; label: string }[] = [
    { id: 'summary', label: t('admin.costs.subTabSummary') },
    { id: 'pricing', label: t('admin.costs.subTabPricing') },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 border-b border-[#1e1e2f]"
      aria-label={t('admin.costs.subTabsAria')}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
            subTab === item.id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ProdSaasAlerts({
  alerts,
  t,
}: {
  alerts: ProdSaasAlert[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (!alerts.length) return null;
  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const className =
          alert.severity === 'critical'
            ? 'bg-red-950/30 border-red-900/40 text-red-300'
            : alert.severity === 'warning'
              ? 'bg-amber-950/30 border-amber-900/40 text-amber-200'
              : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-400';
        // Alertes génériques Intégrations (externalSecretsAlerts.ts) : le backend
        // envoie l'id/nom de variable bruts (jamais une valeur) — on résout ici
        // les libellés traduits avant interpolation.
        const params = alert.params
          ? {
              ...alert.params,
              provider: alert.params.provider
                ? t(`admin.integrations.providers.${alert.params.provider}.title`, {
                    defaultValue: alert.params.provider,
                  })
                : undefined,
              field: alert.params.field
                ? t(`admin.integrations.fields.${alert.params.field}`, { defaultValue: alert.params.field })
                : undefined,
            }
          : undefined;
        return (
          <li key={alert.id} className={`text-xs rounded-xl px-3 py-2 border ${className}`}>
            {t(alert.messageKey, params)}
          </li>
        );
      })}
    </ul>
  );
}

function SaasStatusBadge({
  status,
  requiredInProd,
  t,
}: {
  status: ProdSaasServiceStatus;
  requiredInProd: boolean;
  t: (key: string) => string;
}) {
  const label =
    status === 'configured'
      ? t('admin.costs.saas.statusConfigured')
      : status === 'external'
        ? t('admin.costs.saas.statusExternal')
        : status === 'disabled'
          ? t('admin.costs.saas.statusDisabled')
          : requiredInProd
            ? t('admin.costs.saas.statusMissingRequired')
            : t('admin.costs.saas.statusMissing');

  const className =
    status === 'configured' || status === 'external'
      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50'
      : status === 'disabled'
        ? 'bg-[#1a1a26] text-gray-500 border-[#2d2d3d]'
        : requiredInProd
          ? 'bg-red-950/40 text-red-300 border-red-900/50'
          : 'bg-amber-950/30 text-amber-300 border-amber-900/40';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
      {label}
    </span>
  );
}

function ProdSaasServicesTable({
  services,
  t,
}: {
  services: ProdSaasServiceReport[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[360px]">
        <thead>
          <tr className="border-b border-[#2d2d3d]">
            {[t('admin.costs.saas.colService'), t('admin.costs.saas.colStatus'), t('admin.costs.saas.colCost'), t('admin.costs.saas.colLinks')].map(
              (h) => (
                <th
                  key={h}
                  className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id} className="border-b border-[#1a1a26] last:border-0">
              <td className="py-2 px-2 text-gray-300 align-top">
                <p className="font-medium text-white">
                  {t(`admin.costs.saas.services.${service.id}`, { defaultValue: service.id })}
                </p>
                {service.note && <p className="text-[10px] text-gray-600 mt-0.5">{service.note}</p>}
                {service.flags?.donationsEnabled != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {service.flags.donationsEnabled
                      ? t('admin.costs.saas.flagDonationsOn')
                      : t('admin.costs.saas.flagDonationsOff')}
                    {' · '}
                    {service.flags.subscriptionsEnabled
                      ? t('admin.costs.saas.flagSubscriptionsOn')
                      : t('admin.costs.saas.flagSubscriptionsOff')}
                  </p>
                )}
                {service.flags?.stripeMode != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {t('admin.costs.saas.flagStripeMode', { mode: String(service.flags.stripeMode) })}
                  </p>
                )}
                {service.flags?.s3Uploads != null && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {service.flags.s3Uploads
                      ? t('admin.costs.saas.flagS3On')
                      : t('admin.costs.saas.flagS3Off')}
                  </p>
                )}
              </td>
              <td className="py-2 px-2 align-top">
                <SaasStatusBadge status={service.status} requiredInProd={service.requiredInProd} t={t} />
              </td>
              <td className="py-2 px-2 text-gray-400 align-top whitespace-nowrap">{service.indicativeCost}</td>
              <td className="py-2 px-2 align-top">
                <div className="flex flex-col gap-1">
                  {service.dashboardUrl && (
                    <a
                      href={service.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-purple-400 hover:underline"
                    >
                      {t('admin.costs.saas.linkDashboard')}
                    </a>
                  )}
                  {service.docsUrl && (
                    <a
                      href={service.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-500 hover:text-gray-300 hover:underline"
                    >
                      {t('admin.costs.saas.linkDocs')}
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExternalLinksSection({
  report,
  t,
}: {
  report: ProdSaasStatusReport;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-4">
      {report.linkGroups.map((group) => (
        <div key={group.id}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t(`admin.costs.links.groups.${group.id}`, { defaultValue: group.id })}
          </p>
          <ul className="space-y-1.5">
            {group.links.map((link) => (
              <li key={link.url} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:underline break-all"
                >
                  {link.label}
                </a>
                {link.note && <span className="text-[10px] text-gray-600 shrink-0">{link.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminCostsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [subTab, setSubTab] = useState<CostsSubTab>('summary');
  const [usage, setUsage] = useState<CloudflareUsageReport | null>(null);
  const [donations, setDonations] = useState<DonationsSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [donationsError, setDonationsError] = useState<string | null>(null);
  const [prodSaas, setProdSaas] = useState<ProdSaasStatusReport | null>(null);
  const [prodSaasError, setProdSaasError] = useState<string | null>(null);
  const [legalPreview, setLegalPreview] = useState<LegalKey | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.allSettled([
      api.getCloudflareUsage(token),
      api.getDonationsSummary(token),
      api.getProdSaasStatus(token),
    ]).then(([usageResult, donationsResult, saasResult]) => {
        if (usageResult.status === 'fulfilled') {
          setUsage(usageResult.value);
          setError(null);
        } else {
          setError(
            usageResult.reason instanceof Error
              ? usageResult.reason.message
              : t('admin.costs.error')
          );
        }

        if (donationsResult.status === 'fulfilled') {
          setDonations(donationsResult.value);
          setDonationsError(null);
        } else {
          setDonationsError(
            donationsResult.reason instanceof Error
              ? donationsResult.reason.message
              : t('admin.costs.donationsError')
          );
        }

        if (saasResult.status === 'fulfilled') {
          setProdSaas(saasResult.value);
          setProdSaasError(null);
        } else {
          setProdSaasError(
            saasResult.reason instanceof Error
              ? saasResult.reason.message
              : t('admin.costs.saas.error')
          );
        }

        setLoading(false);
      }
    );
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const fixedTotalMidEur = 42.9;
  const fixedTotal = '~41–45 €/mois';
  const platformFeePercent = donations?.platformFeePercent ?? 30;

  const monthlyEstimateEur =
    usage?.configured && usage.estimatedCostEur
      ? usage.estimatedCostEur.total + fixedTotalMidEur
      : null;

  if (legalPreview) {
    return <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <CostsSubTabBar subTab={subTab} onChange={setSubTab} t={t} />

      {subTab === 'summary' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">{t('admin.costs.summarySubtitle')}</p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 shrink-0"
            >
              {loading ? '...' : t('admin.costs.refresh')}
            </button>
          </div>

          {usage?.fetchedAt && (
            <p className="text-[10px] text-gray-600">
              {t('admin.costs.lastUpdated', { date: formatDateTime(usage.fetchedAt, locale) })}
            </p>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <SectionCard title={t('admin.costs.donationsTitle')}>
            <p className="text-[10px] text-gray-600">
              {t('admin.costs.donationsSubtitle', { percent: platformFeePercent })}
            </p>
            {donations?.simulationMode && (
              <p className="text-[10px] text-yellow-400/90">{t('admin.costs.donationsSimulationBadge')}</p>
            )}
            {donationsError && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
                {donationsError}
              </div>
            )}
            {donations && (
              <div className="space-y-4">
                <DonationsPeriodStats
                  title={t('admin.costs.donationsAllTime')}
                  period={donations.allTime}
                  locale={locale}
                  t={t}
                />
                <DonationsPeriodStats
                  title={t('admin.costs.donationsThisMonth')}
                  period={donations.thisMonth}
                  locale={locale}
                  t={t}
                />
              </div>
            )}
            {!donations && !donationsError && loading && (
              <p className="text-xs text-gray-500">...</p>
            )}
            <button
              type="button"
              onClick={() =>
                setLegalPreview((donations?.paymentTermsDocKey as LegalKey | undefined) ?? 'creatorMonetization')
              }
              className="text-[10px] text-purple-400 hover:underline"
            >
              {t('admin.costs.donationsLegalLink')}
            </button>
          </SectionCard>

          <SectionCard title={t('admin.costs.fixedTitle')}>
            <DataTable
              headers={[t('admin.costs.colService'), t('admin.costs.colAmount'), t('admin.costs.colNote')]}
              rows={FIXED_COSTS.map((c) => [c.label, c.amount, c.note])}
            />
            <p className="text-xs text-gray-400 pt-1">
              {t('admin.costs.fixedTotal', { amount: fixedTotal })}
            </p>
          </SectionCard>

          <SectionCard title={t('admin.costs.saas.title')}>
            <p className="text-[10px] text-gray-600">{t('admin.costs.saas.subtitle')}</p>
            {prodSaas && (
              <p className="text-[10px] text-gray-500">
                {t('admin.costs.saas.environment', {
                  env: t(`admin.costs.saas.env.${prodSaas.environment}`),
                })}
              </p>
            )}
            {prodSaasError && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
                {prodSaasError}
              </div>
            )}
            {prodSaas?.alerts?.length ? (
              <ProdSaasAlerts alerts={prodSaas.alerts} t={t} />
            ) : null}
            {prodSaas ? (
              <ProdSaasServicesTable services={prodSaas.services} t={t} />
            ) : (
              !prodSaasError && loading && <p className="text-xs text-gray-500">...</p>
            )}
          </SectionCard>

          <SectionCard title={t('admin.costs.realtimeTitle')}>
            {!usage?.configured ? (
              <p className="text-sm text-yellow-400/90">{t('admin.costs.cfNotConfigured')}</p>
            ) : (
              <>
                <p className="text-[10px] text-gray-600">
                  {t('admin.costs.periodRange', {
                    start: usage.periodStart,
                    end: usage.periodEnd,
                  })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox
                    label={t('admin.costs.minutesDelivered')}
                    value={formatNumber(usage.minutesDelivered, locale)}
                    sub={
                      usage.minutesDeliveredSource === 'graphql'
                        ? t('admin.costs.sourceGraphql')
                        : t('admin.costs.sourceUnavailable')
                    }
                  />
                  <StatBox
                    label={t('admin.costs.storageMinutes')}
                    value={formatNumber(usage.storageMinutes, locale)}
                    sub={
                      usage.storageMinutesSource === 'videos_api'
                        ? t('admin.costs.sourceVideosApi')
                        : t('admin.costs.sourceUnavailable')
                    }
                  />
                  <StatBox
                    label={t('admin.costs.liveInputsTotal')}
                    value={String(usage.liveInputsTotal)}
                  />
                  <StatBox
                    label={t('admin.costs.liveInputsActive')}
                    value={String(usage.liveInputsActive)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <StatBox
                    label={t('admin.costs.estimatedCfUsd')}
                    value={`$${formatNumber(usage.estimatedCostUsd.total, locale)}`}
                    sub={`${t('admin.costs.delivery')}: $${formatNumber(usage.estimatedCostUsd.delivery, locale)} · ${t('admin.costs.storage')}: $${formatNumber(usage.estimatedCostUsd.storage, locale)}`}
                  />
                  <StatBox
                    label={t('admin.costs.estimatedCfEur')}
                    value={`${formatNumber(usage.estimatedCostEur.total, locale)} €`}
                    sub={t('admin.costs.eurRate', { rate: usage.usdToEurRate })}
                  />
                </div>
                {usage.warnings.length > 0 && (
                  <ul className="text-[10px] text-gray-500 space-y-1 pt-1">
                    {usage.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title={t('admin.costs.monthlyEstimateTitle')}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{t('admin.costs.fixedInfra')}</span>
                <span>{fixedTotal}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('admin.costs.variableCf')}</span>
                <span>
                  {usage?.configured
                    ? `${formatNumber(usage.estimatedCostEur.total, locale)} €`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-white border-t border-[#2d2d3d] pt-2">
                <span>{t('admin.costs.totalEstimate')}</span>
                <span className="text-purple-300">
                  {monthlyEstimateEur != null
                    ? `~${formatNumber(monthlyEstimateEur, locale)} €`
                    : `~${fixedTotal}`}
                </span>
              </div>
              <p className="text-[10px] text-gray-600">{t('admin.costs.estimateDisclaimer')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('admin.costs.links.title')}>
            <p className="text-[10px] text-gray-600">{t('admin.costs.links.subtitle')}</p>
            {prodSaas ? (
              <ExternalLinksSection report={prodSaas} t={t} />
            ) : (
              !prodSaasError && loading && <p className="text-xs text-gray-500">...</p>
            )}
          </SectionCard>
        </div>
      )}

      {subTab === 'pricing' && (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">{t('admin.costs.pricingSubtitle')}</p>

          <SectionCard title={t('admin.costs.donationsCommissionTitle')}>
            <p className="text-sm text-gray-300">{t('admin.costs.donationsCommissionBody', { percent: platformFeePercent })}</p>
            <button
              type="button"
              onClick={() =>
                setLegalPreview((donations?.paymentTermsDocKey as LegalKey | undefined) ?? 'creatorMonetization')
              }
              className="text-[10px] text-purple-400 hover:underline"
            >
              {t('admin.costs.donationsLegalLink')}
            </button>
          </SectionCard>

          <SectionCard title={t('admin.costs.livekitTitle')}>
            <DataTable
              headers={[t('admin.costs.colTier'), t('admin.costs.colPrice'), t('admin.costs.colLimits')]}
              rows={LIVEKIT_TIERS.map((l) => [l.tier, l.price, l.limits])}
            />
          </SectionCard>

          <SectionCard title={t('admin.costs.cfPricingTitle')}>
            <DataTable
              headers={[t('admin.costs.colItem'), t('admin.costs.colPrice')]}
              rows={CF_PRICING.map((p) => [p.item, p.price])}
            />
          </SectionCard>

          <SectionCard title={t('admin.costs.comparisonTitle')}>
            <p className="text-[10px] text-gray-600 mb-2">{t('admin.costs.comparisonHint')}</p>
            <DataTable
              headers={[
                t('admin.costs.colScenario'),
                'Mesh',
                'LiveKit',
                'Cloudflare',
                t('admin.costs.colHybrid'),
              ]}
              rows={SCALE_COMPARISON.map((s) => [
                `${s.scenario}\n${s.detail}`,
                s.mesh,
                s.livekit,
                s.cloudflare,
                s.hybrid,
              ])}
            />
          </SectionCard>

          <p className="text-[10px] text-gray-600 text-center">
            {t('admin.costs.docRef')}{' '}
            <span className="text-purple-400">docs/COUT-APPLICATION.md</span>
            {' · '}
            {t('admin.costs.docHint')}{' '}
            <a
              href="https://developers.cloudflare.com/stream/pricing/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Cloudflare Stream
            </a>
            {' · '}
            <a
              href="https://cloud.livekit.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              LiveKit Cloud
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
