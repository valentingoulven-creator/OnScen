import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/formatCount';
import type { SponsorAdminFormState } from '../lib/sponsorAdminForm';
import type { SponsorAudienceEstimate } from '../types';

function parseOptionalCoord(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SponsorAudienceEstimatePanel({ form }: { form: SponsorAdminFormState }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [estimate, setEstimate] = useState<SponsorAudienceEstimate | null>(null);
  const [loading, setLoading] = useState(false);

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
        .then((res) => setEstimate(res.estimate))
        .catch(() => setEstimate(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [token, payloadKey, form.placement, form.mapVisibilityScope, form.mapTargetLat, form.mapTargetLng]);

  const hintKey =
    estimate?.basis === 'active_30d_region'
      ? 'admin.sponsors.audienceHintRegion'
      : estimate?.basis === 'active_30d_rotation'
        ? 'admin.sponsors.audienceHintRotation'
        : 'admin.sponsors.audienceHintAll';

  return (
    <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3 space-y-1">
      <p className="text-xs font-semibold text-cyan-200">{t('admin.sponsors.audienceTitle')}</p>
      <p className="text-2xl font-bold text-white tabular-nums">
        {loading ? '…' : formatCompactCount(estimate?.estimatedUsers ?? 0)}
      </p>
      <p className="text-[10px] text-gray-400 leading-snug">
        {loading
          ? t('admin.sponsors.audienceLoading')
          : t(hintKey, {
              eligible: formatCompactCount(estimate?.eligibleUsers ?? 0),
              radius: estimate?.regionRadiusKm ?? 0,
              everyN: estimate?.rotationEveryN ?? 0,
            })}
      </p>
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
