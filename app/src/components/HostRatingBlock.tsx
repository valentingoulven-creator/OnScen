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
}: HostRatingBlockProps) {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<HostRatingSummary | null>(null);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user?.id === hostId;

  useEffect(() => {
    if (!token || isBot) return;
    api.getHostRating(token, hostId).then((r) => setSummary(r.rating));
  }, [token, hostId, isBot]);

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

  if (isBot) {
    if (inline) return null;
    return (
      <p className="text-[10px] text-gray-500">Compte démo — notation non disponible</p>
    );
  }

  if (isSelf) {
    const avg = summary?.average ?? user?.hostRating?.average ?? 0;
    const count = summary?.count ?? user?.hostRating?.count ?? 0;
    if (inline) {
      return (
        <span className="text-[10px] text-gray-500 shrink-0">
          <span className="text-amber-400 font-bold">{avg > 0 ? `${avg} ★` : '—'}</span>
          {count > 0 && <span className="text-gray-600"> ({count})</span>}
        </span>
      );
    }
    return (
      <p className="text-xs text-gray-400">
        Votre note moyenne :{' '}
        <span className="text-amber-400 font-bold">{avg > 0 ? `${avg} ★` : '—'}</span>
        {count > 0 && <span className="text-gray-500"> ({count} avis)</span>}
      </p>
    );
  }

  const displayHover = hover || summary?.userRating || 0;

  const stars = (
    <div className={`flex items-center gap-0.5 shrink-0 ${starSizeClass}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarButton
          key={n}
          value={n}
          filled={(summary?.userRating ?? 0) >= n}
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
        {summary && summary.count > 0 && (
          <span className="text-[9px] text-gray-500 shrink-0 tabular-nums">
            <span className="text-amber-400 font-bold">{summary.average}</span>
            <span className="text-gray-600"> ({summary.count})</span>
          </span>
        )}
        {error && <span className="text-[9px] text-red-400 shrink-0">{error}</span>}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-semibold text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Noter {hostName}
        </p>
        {summary && summary.count > 0 && (
          <p className="text-[10px] text-gray-500 shrink-0">
            <span className="text-amber-400 font-bold">{summary.average}</span> · {summary.count} avis
          </p>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <StarButton
            key={n}
            value={n}
            filled={(summary?.userRating ?? 0) >= n}
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
