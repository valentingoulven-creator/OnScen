import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/formatCount';
import {
  computeTierExposedUsers,
  SPONSOR_SCALE_TIERS,
  type SponsorScaleTier,
} from '../lib/sponsorPricing';
import type { SponsorAdminFormState } from '../lib/sponsorAdminForm';
import type { SponsorAudienceEstimate } from '../types';

function parseOptionalCoord(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAudienceInput(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function SponsorAudienceEstimatePanel({ form }: { form: SponsorAdminFormState }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [estimate, setEstimate] = useState<SponsorAudienceEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [audienceInput, setAudienceInput] = useState('');
  const userTouchedRef = useRef(false);

  const payloadKey = useMemo(
    () =>
      JSON.stringify({
        placement: form.placement,
        mapVisibilityScope: form.mapVisibilityScope,
        mapTargetLat: form.mapTargetLat,
        mapTargetLng: form.mapTargetLng,
      }),
    [form.placement, form.mapVisibilityScope, form.mapTargetLat, form.mapTargetLng]
  );

  useEffect(() => {
    if (!token) {
      setEstimate(null);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api
        .estimateAdminSponsorAudience(token, {
          placement: form.placement,
          mapVisibilityScope: form.mapVisibilityScope,
          mapTargetLat: parseOptionalCoord(form.mapTargetLat),
          mapTargetLng: parseOptionalCoord(form.mapTargetLng),
        })
        .then((res) => {
          setEstimate(res.estimate);
          if (!userTouchedRef.current) {
            setAudienceInput(String(res.estimate.estimatedUsers));
          }
        })
        .catch(() => setEstimate(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [token, payloadKey, form.placement, form.mapVisibilityScope, form.mapTargetLat, form.mapTargetLng]);

  const selectedAudience = parseAudienceInput(audienceInput);
  const liveEstimate = estimate?.estimatedUsers ?? 0;

  const applyPreset = (value: number) => {
    userTouchedRef.current = true;
    setAudienceInput(String(value));
  };

  const applyTierPreset = (tier: SponsorScaleTier) => {
    applyPreset(computeTierExposedUsers(tier, form.placement));
  };

  const hintKey =
    estimate?.basis === 'active_30d_region'
      ? 'admin.sponsors.audienceHintRegion'
      : estimate?.basis === 'active_30d_rotation'
        ? 'admin.sponsors.audienceHintRotation'
        : 'admin.sponsors.audienceHintAll';

  return (
    <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3 space-y-2">
      <p className="text-xs font-semibold text-cyan-200">{t('admin.sponsors.audienceTitle')}</p>

      <p className="text-2xl font-bold text-white tabular-nums">
        {loading && !userTouchedRef.current ? '…' : formatCompactCount(selectedAudience)}
      </p>

      <label className="block text-[10px] text-gray-400">
        {t('admin.sponsors.audienceInputLabel')}
        <input
          type="number"
          min={0}
          className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white tabular-nums"
          value={audienceInput}
          onChange={(e) => {
            userTouchedRef.current = true;
            setAudienceInput(e.target.value);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={loading || liveEstimate <= 0}
          onClick={() => applyPreset(liveEstimate)}
          className="min-h-[36px] px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-cyan-500/30 bg-cyan-950/30 text-cyan-100 hover:border-cyan-400/50 disabled:opacity-40"
        >
          {t('admin.sponsors.audiencePresetActual', {
            count: loading ? '…' : formatCompactCount(liveEstimate),
          })}
        </button>
        {SPONSOR_SCALE_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => applyTierPreset(tier)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-[#2d2d3d] bg-[#1a1a26] text-gray-200 hover:border-cyan-500/30"
          >
            {t(tier.labelKey)}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">
        {loading
          ? t('admin.sponsors.audienceLoading')
          : t(hintKey, {
              eligible: formatCompactCount(estimate?.eligibleUsers ?? 0),
              radius: estimate?.regionRadiusKm ?? 0,
              everyN: estimate?.rotationEveryN ?? 0,
            })}
      </p>
      {!loading && liveEstimate > 0 && selectedAudience !== liveEstimate ? (
        <p className="text-[10px] text-cyan-300/80 leading-snug">
          {t('admin.sponsors.audienceCustomHint', {
            count: formatCompactCount(liveEstimate),
          })}
        </p>
      ) : null}
    </section>
  );
}

export function formatSponsorAudienceEstimateLabel(
  estimate: SponsorAudienceEstimate | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!estimate) return '—';
  return t('admin.sponsors.listAudienceEstimate', {
    count: formatCompactCount(estimate.estimatedUsers),
  });
}
