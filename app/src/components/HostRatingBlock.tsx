import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { HostRatingSummary } from '../types';

interface HostRatingBlockProps {
  hostId: string;
  hostName: string;
  isBot?: boolean;
  salonId?: string;
  liveId?: string;
  compact?: boolean;
  /** Étoiles atténuées (fiche carte). */
  mutedStars?: boolean;
  /** Nom + étoiles sur une seule ligne (bandeau live / fiche carte). */
  inline?: boolean;
  /** Masque « Noter {hostName} » quand le nom est déjà affiché à côté. */
  hideLabel?: boolean;
  /** Centrer le bloc (fiche profil). */
  centered?: boolean;
  /** Badge compact : ★ + moyenne (header profil). */
  averageOnly?: boolean;
  /** Note agrégée déjà fournie par le profil (/me ou profil public). */
  initialRating?: HostRatingSummary;
}

function pickHostRating(
  fetched: HostRatingSummary | null,
  initial?: HostRatingSummary
): HostRatingSummary | null {
  if (fetched?.count) return fetched;
  if (initial?.count) return initial;
  return fetched ?? initial ?? null;
}

function formatHostAverage(avg: number): string {
  if (!(avg > 0)) return '—';
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

function StarButton({
  value,
  filled,
  hover,
  onSelect,
  onHover,
  disabled,
  muted,
  sizeClass = 'text-xl',
}: {
  value: number;
  filled: boolean;
  hover: number;
  onSelect: (n: number) => void;
  onHover: (n: number) => void;
  disabled: boolean;
  muted?: boolean;
  sizeClass?: string;
}) {
  const active = value <= hover || (hover === 0 && filled);
  const activeClass = muted
    ? active
      ? 'text-[#a5a5c5]'
      : 'text-[#3a3a4a]'
    : active
      ? 'text-amber-400'
      : 'text-gray-600';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      onMouseEnter={() => onHover(value)}
      onMouseLeave={() => onHover(0)}
      className={`${sizeClass} leading-none transition ${activeClass} disabled:opacity-40`}
      aria-label={`${value} étoile${value > 1 ? 's' : ''}`}
    >
      ★
    </button>
  );
}

export function HostRatingBlock({
  hostId,
  hostName,
  isBot,
  salonId,
  liveId,
  compact,
  mutedStars,
  inline,
  hideLabel,
  centered,
  averageOnly,
  initialRating,
}: HostRatingBlockProps) {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<HostRatingSummary | null>(null);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user?.id === hostId;

  useEffect(() => {
    if (!token || isBot) return;
    let cancelled = false;
    api
      .getHostRating(token, hostId)
      .then((r) => {
        if (!cancelled) setSummary(r.rating);
      })
      .catch(() => {
        /* garde initialRating / profil */
      });
    return () => {
      cancelled = true;
    };
  }, [token, hostId, isBot]);

  const profileFallback = isSelf ? user?.hostRating : initialRating;
  const effective = pickHostRating(summary, profileFallback);

  const submit = async (stars: number) => {
    if (!token || isSelf || isBot || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { rating } = await api.rateHost(token, hostId, stars, { salonId, liveId });
      setSummary(rating);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const starSizeClass = inline || compact ? 'text-sm' : 'text-xl';

  if (averageOnly) {
    if (isBot) return null;
    const display = formatHostAverage(effective?.average ?? 0);
    return (
      <span className="inline-flex items-center gap-0.5 shrink-0 text-[11px] tabular-nums leading-none">
        <span className="text-amber-400 text-[10px]" aria-hidden>
          ★
        </span>
        <span className="text-amber-400/90 font-semibold">{display}</span>
      </span>
    );
  }

  if (isBot) {
    if (inline) return null;
    return (
      <p className="text-[10px] text-gray-500">Compte démo — notation non disponible</p>
    );
  }

  if (isSelf) {
    const avg = effective?.average ?? 0;
    const count = effective?.count ?? 0;
    const avgLabel = formatHostAverage(avg);
    if (inline) {
      return (
        <span className="text-[10px] text-gray-500 shrink-0">
          <span className="text-amber-400 font-bold">{avgLabel === '—' ? '—' : `${avgLabel} ★`}</span>
          {count > 0 && <span className="text-gray-600"> ({count})</span>}
        </span>
      );
    }
    return (
      <p className={`text-xs text-gray-400${centered ? ' text-center' : ''}`}>
        Votre note moyenne :{' '}
        <span className="text-amber-400 font-bold">{avgLabel === '—' ? '—' : `${avgLabel} ★`}</span>
        {count > 0 && <span className="text-gray-500"> ({count} avis)</span>}
      </p>
    );
  }

  const displayHover = hover || effective?.userRating || summary?.userRating || 0;

  const stars = (
    <div className={`flex items-center gap-0.5 shrink-0 ${starSizeClass}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarButton
          key={n}
          value={n}
          filled={(effective?.userRating ?? summary?.userRating ?? 0) >= n}
          hover={displayHover}
          onSelect={submit}
          onHover={setHover}
          disabled={saving}
          muted={mutedStars}
          sizeClass={starSizeClass}
        />
      ))}
    </div>
  );

  if (inline) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        {!hideLabel && (
          <span className={`font-semibold text-gray-300 truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
            Noter {hostName}
          </span>
        )}
        {stars}
        {effective && effective.count > 0 && (
          <span className="text-[9px] text-gray-500 shrink-0 tabular-nums">
            <span className="text-amber-400 font-bold">{formatHostAverage(effective.average)}</span>
            <span className="text-gray-600"> ({effective.count})</span>
          </span>
        )}
        {error && <span className="text-[9px] text-red-400 shrink-0">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-1' : 'space-y-2'}${centered ? ' text-center' : ''}`}>
      <div
        className={`flex items-center gap-2 ${
          centered ? 'flex-col justify-center' : 'justify-between'
        }`}
      >
        <p className={`font-semibold text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Noter {hostName}
        </p>
        {effective && effective.count > 0 && (
          <p className="text-[10px] text-gray-500 shrink-0">
            <span className="text-amber-400 font-bold">{formatHostAverage(effective.average)}</span> ·{' '}
            {effective.count} avis
          </p>
        )}
      </div>

      <div className={`flex items-center gap-0.5${centered ? ' justify-center' : ''}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarButton
            key={n}
            value={n}
            filled={(effective?.userRating ?? summary?.userRating ?? 0) >= n}
            hover={displayHover}
            onSelect={submit}
            onHover={setHover}
            disabled={saving}
            muted={mutedStars}
            sizeClass={starSizeClass}
          />
        ))}
        {summary?.userRating && (
          <span className="text-[10px] text-gray-500 ml-2">
            {saving ? '...' : 'Votre note'}
          </span>
        )}
      </div>

      {!summary?.userRating && !compact && (
        <p className="text-[10px] text-gray-500">Touchez une étoile pour noter ce host</p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
