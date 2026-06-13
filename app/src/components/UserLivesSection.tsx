import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export interface ArchivedLive {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  thumbnailUrl?: string;
  platform: string;
  isActive: false;
  adminBlocked?: boolean;
}

interface UserLivesSectionProps {
  userId: string;
  isOwner?: boolean;
  hideSectionTitle?: boolean;
  onOpenLive?: (liveId: string) => void;
}

function formatLiveDuration(ms: number, locale: string): string {
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  if (totalMin < 60) {
    return locale.startsWith('fr') ? `${totalMin} min` : `${totalMin} min`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (locale.startsWith('fr')) {
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatLiveDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale.startsWith('fr') ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function LiveArchiveCard({
  live,
  showHost,
  locale,
  onOpen,
}: {
  live: ArchivedLive;
  showHost: boolean;
  locale: string;
  onOpen?: (liveId: string) => void;
}) {
  const { t } = useTranslation();
  const duration = formatLiveDuration(live.durationMs, locale);
  const date = formatLiveDate(live.endedAt, locale);

  const content = (
    <>
      <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[#1a1a26] border border-[#2d2d3d]">
        {live.thumbnailUrl ? (
          <img src={live.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-red-400/80" aria-hidden>
            ●
          </div>
        )}
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-white">
          {duration}
        </span>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-bold text-white text-sm truncate">{live.title}</p>
        {showHost && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{live.hostName}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{date}</p>
        {live.adminBlocked && (
          <p className="text-[10px] text-amber-400/90 mt-1">{t('profile.lives.blocked')}</p>
        )}
      </div>
      {onOpen && (
        <span className="shrink-0 self-center text-gray-500 text-lg" aria-hidden>
          ›
        </span>
      )}
    </>
  );

  const className =
    'w-full flex items-center gap-3 p-3 rounded-xl bg-[#12121a] border border-[#1e1e2f] hover:border-[#2d2d3d] hover:bg-[#1a1a26] transition text-left';

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(live.id)} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function UserLivesSection({
  userId,
  isOwner = false,
  hideSectionTitle = false,
  onOpenLive,
}: UserLivesSectionProps) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [lives, setLives] = useState<ArchivedLive[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLives = useCallback(() => {
    if (!token) {
      setLives([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api
      .getUserLives(token, userId)
      .then((r) => setLives(r.lives))
      .catch(() => setLives([]))
      .finally(() => setLoading(false));
  }, [token, userId]);

  useEffect(() => {
    void loadLives();
  }, [loadLives]);

  const sectionTitle = isOwner ? t('profile.lives.myTitle') : t('profile.lives.title');
  const emptyMessage = isOwner ? t('profile.lives.emptyOwner') : t('profile.lives.empty');

  return (
    <section className="p-4 max-w-lg mx-auto w-full">
      {!hideSectionTitle && (
        <h2 className="text-sm font-bold text-white mb-3">{sectionTitle}</h2>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      ) : lives.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl mb-3" aria-hidden>
            📻
          </p>
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lives.map((live) => (
            <li key={live.id}>
              <LiveArchiveCard
                live={live}
                showHost={!isOwner}
                locale={i18n.language}
                onOpen={onOpenLive}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
