import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTrendsCountrySubtitle, rankMedal } from '../lib/countryDisplay';
import type { TrendingUser } from '../types';

function FeedSectionHeader({
  id,
  label,
  emoji,
  subtitle,
}: {
  id?: string;
  label: string;
  emoji: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-base leading-none">{emoji}</span>
      <h3
        id={id}
        className="text-xs font-bold text-gray-300 tracking-wide uppercase"
      >
        {label}
      </h3>
      {subtitle ? (
        <span className="text-[10px] max-[374px]:text-[11px] text-gray-500 font-normal normal-case tracking-normal">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

const TrendingUserCard = memo(function TrendingUserCard({
  user,
  onOpenProfile,
}: {
  user: TrendingUser;
  onOpenProfile: (userId: string) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(user.userId)}
      className="flex flex-col items-center gap-1.5 w-20 shrink-0"
      aria-label={`Voir le profil de ${user.username}`}
    >
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-900 to-purple-900 border-2 border-[#2a2a3d]">
        {user.avatarUrl && imgOk ? (
          <img
            src={user.avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-purple-300 uppercase">
            {user.username.charAt(0)}
          </div>
        )}
        <div className="absolute top-0 left-0 bg-black/50 rounded-br-lg px-1 py-0.5 text-[10px] font-bold text-white leading-none">
          {user.rank <= 3 ? rankMedal(user.rank) : `#${user.rank}`}
        </div>
        {user.liveCount > 0 ? (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full border border-[#0b0b0f] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </div>
        ) : null}
      </div>
      <p className="text-[10px] font-semibold text-white text-center leading-tight line-clamp-1 w-full">
        {user.username}
      </p>
      {user.totalParticipants > 0 ? (
        <p className="text-[9px] text-gray-500 tabular-nums leading-none">
          {user.totalParticipants}
        </p>
      ) : null}
    </button>
  );
});

export function FeedTrendingUsersSection({
  users,
  loading,
  countryCode,
  countryName,
  onOpenProfile,
  className = '',
  hideHeader = false,
}: {
  users: TrendingUser[];
  loading: boolean;
  countryCode: string;
  countryName: string;
  onOpenProfile: (userId: string) => void;
  className?: string;
  /** Masque le titre interne (ex. home Musique avec en-tête Spotify). */
  hideHeader?: boolean;
}) {
  const { t } = useTranslation();
  const subtitle = formatTrendsCountrySubtitle(countryCode, countryName);

  return (
    <section
      className={`space-y-2.5 ${className}`}
      aria-labelledby={hideHeader ? undefined : 'feed-trends-week'}
    >
      {hideHeader ? null : (
        <FeedSectionHeader
          id="feed-trends-week"
          label={t('feed.trendsWeek', { defaultValue: 'TENDANCES DE LA SEMAINE' })}
          emoji="🔥"
          subtitle={subtitle}
        />
      )}
      {loading && users.length === 0 ? (
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="flex gap-4 w-max pb-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 w-20 shrink-0">
                <div className="w-16 h-16 rounded-full bg-[#1e1e2f] animate-pulse" />
                <div className="w-14 h-2 rounded bg-[#1e1e2f] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : users.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">
          {t('feed.trendsEmpty', { defaultValue: 'Aucun live ou session pour le moment' })}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="flex gap-4 w-max pb-1">
            {users.map((user) => (
              <TrendingUserCard key={user.userId} user={user} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
