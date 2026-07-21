import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/formatCount';
import {
  computeSponsorCampaignPriceEur,
  computeTierPlacementQuotes,
  formatEurPrice,
  SPONSOR_PRICING_PLACEMENTS,
  SPONSOR_SCALE_TIERS,
  SPONSOR_TIER_DURATION_PRESETS,
  type SponsorScaleTierId,
} from '../lib/sponsorPricing';
import { DEFAULT_SPONSOR_DISPLAY_DAYS } from '../lib/sponsorAdminForm';
import type { SponsorPlacement } from '../types';

function benchmarkPlatformLabel(
  platform: 'instagram' | 'tiktok' | 'meta',
  t: (key: string) => string
): string {
  if (platform === 'tiktok') return t('admin.sponsors.pricingPlatformTiktok');
  if (platform === 'instagram') return t('admin.sponsors.pricingPlatformInstagram');
  return t('admin.sponsors.pricingPlatformMeta');
}

export function AdminSponsorsPricingTab() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [selectedTierId, setSelectedTierId] = useState<SponsorScaleTierId>('50k');
  const [platformAudience, setPlatformAudience] = useState(0);
  const [audienceInput, setAudienceInput] = useState('');
  const [daysInput, setDaysInput] = useState(String(DEFAULT_SPONSOR_DISPLAY_DAYS));

  useEffect(() => {
    if (!token) return;
    void api
      .estimateAdminSponsorAudience(token, { placement: 'feed_inline' })
      .then((res) => {
        const eligible = res.estimate.eligibleUsers;
        setPlatformAudience(eligible);
        setAudienceInput(String(eligible));
      })
      .catch(() => undefined);
  }, [token]);

  const audienceUsers = useMemo(() => {
    const n = Number(audienceInput);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }, [audienceInput]);

  const displayDays = useMemo(() => {
    const n = Number(daysInput);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_SPONSOR_DISPLAY_DAYS;
  }, [daysInput]);

  const tierQuotes = useMemo(
    () => computeTierPlacementQuotes(selectedTierId),
    [selectedTierId]
  );

  const selectedTier = tierQuotes[0]?.tier;

  const quotes = useMemo(
    () =>
      SPONSOR_PRICING_PLACEMENTS.map((placement) => ({
        placement,
        quote: computeSponsorCampaignPriceEur({ placement, audienceUsers, displayDays }),
      })),
    [audienceUsers, displayDays]
  );

  const placementLabel = (placement: SponsorPlacement) => t(`admin.sponsors.placement.${placement}`);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-purple-500/30 bg-[#12121a] p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-purple-300">{t('admin.sponsors.pricingTierTitle')}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('admin.sponsors.pricingTierSubtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SPONSOR_SCALE_TIERS.map((tier) => {
            const active = selectedTier?.id === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTierId(tier.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-purple-600/30 border-purple-400 text-white'
                    : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-purple-500/40'
                }`}
              >
                {t(tier.labelKey)}
              </button>
            );
          })}
        </div>

        {selectedTier ? (
          <div className="rounded-xl bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2 text-[11px] text-gray-400 leading-relaxed">
            <p className="text-white font-medium">{t(selectedTier.descriptionKey)}</p>
            <p className="mt-1">
              {t('admin.sponsors.pricingTierStats', {
                registered: formatCompactCount(selectedTier.registeredUsers),
                active: formatCompactCount(tierQuotes[0]?.active30dUsers ?? 0),
                rate: Math.round(selectedTier.active30dRate * 100),
              })}
            </p>
          </div>
        ) : null}

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[720px] text-left text-xs border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
                <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColPlacement')}</th>
                <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColExposedUsers')}</th>
                <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColSoundyCpm')}</th>
                {SPONSOR_TIER_DURATION_PRESETS.map((days) => (
                  <th key={days} className="py-2 pr-3 font-semibold tabular-nums">
                    {t('admin.sponsors.pricingColDaysPrice', { days })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tierQuotes.map((row) => (
                <tr key={row.placement} className="border-b border-[#1e1e2f]/80 align-top">
                  <td className="py-3 pr-3 min-w-[8rem]">
                    <p className="font-semibold text-white">{placementLabel(row.placement)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {t('admin.sponsors.pricingPenetrationHint', {
                        rate: Math.round(row.penetrationRate * 100),
                      })}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-white font-semibold tabular-nums">
                    {formatCompactCount(row.exposedUsers)}
                  </td>
                  <td className="py-3 pr-3 text-purple-200 font-semibold tabular-nums">
                    {formatEurPrice(row.soundyCpmEur, i18n.language)}
                  </td>
                  {SPONSOR_TIER_DURATION_PRESETS.map((days) => (
                    <td key={days} className="py-3 pr-3 tabular-nums">
                      <p className="text-sm font-bold text-white">
                        {formatEurPrice(row.pricesByDays[days], i18n.language)}
                      </p>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-gray-500 leading-snug">{t('admin.sponsors.pricingTierFormulaHint')}</p>
      </section>

      <section className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-purple-300">{t('admin.sponsors.pricingTitle')}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('admin.sponsors.pricingSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-gray-400">
            {t('admin.sponsors.pricingAudienceLabel')}
            <input
              type="number"
              min={0}
              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
              value={audienceInput}
              onChange={(e) => setAudienceInput(e.target.value)}
            />
            {platformAudience > 0 ? (
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                {t('admin.sponsors.pricingPlatformAudienceHint', {
                  count: formatCompactCount(platformAudience),
                })}
              </span>
            ) : null}
          </label>
          <label className="block text-xs text-gray-400">
            {t('admin.sponsors.pricingDaysLabel')}
            <input
              type="number"
              min={1}
              max={365}
              className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
            />
          </label>
        </div>

        <p className="text-[10px] text-gray-500 leading-snug">{t('admin.sponsors.pricingFormulaHint')}</p>
      </section>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[640px] text-left text-xs border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
              <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColPlacement')}</th>
              <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColBenchmark')}</th>
              <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColSoundyCpm')}</th>
              <th className="py-2 pr-3 font-semibold">{t('admin.sponsors.pricingColSoundyPrice')}</th>
              <th className="py-2 font-semibold">{t('admin.sponsors.pricingColMarketRange')}</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map(({ placement, quote }) => (
              <tr key={placement} className="border-b border-[#1e1e2f]/80 align-top">
                <td className="py-3 pr-3 min-w-[8rem]">
                  <p className="font-semibold text-white">{placementLabel(placement)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t(quote.pricingCompKey)}</p>
                </td>
                <td className="py-3 pr-3 text-gray-300 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] px-2 py-0.5 text-[10px] mb-1">
                    {benchmarkPlatformLabel(quote.benchmarkPlatform, t)}
                  </span>
                  <p>
                    {formatEurPrice(quote.benchmarkCpmMinEur, i18n.language)} –{' '}
                    {formatEurPrice(quote.benchmarkCpmMaxEur, i18n.language)} CPM
                  </p>
                </td>
                <td className="py-3 pr-3 text-purple-200 font-semibold tabular-nums">
                  {formatEurPrice(quote.soundyCpmEur, i18n.language)}
                </td>
                <td className="py-3 pr-3">
                  <p className="text-base font-bold text-white tabular-nums">
                    {formatEurPrice(quote.soundyPriceEur, i18n.language)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {t('admin.sponsors.pricingImpressions', {
                      count: formatCompactCount(quote.impressions),
                    })}
                  </p>
                </td>
                <td className="py-3 text-gray-400 tabular-nums">
                  {formatEurPrice(quote.benchmarkPriceMinEur, i18n.language)} –{' '}
                  {formatEurPrice(quote.benchmarkPriceMaxEur, i18n.language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-500 leading-relaxed px-0.5">{t('admin.sponsors.pricingDisclaimer')}</p>
    </div>
  );
}
