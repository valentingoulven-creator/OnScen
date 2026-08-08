import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  canAccessArchivedLives,
  type PlatformPlanId,
} from '../lib/subscriptions';

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
  replayPlaybackUrl?: string;
  streamMode?: string;
  peakViewersCount?: number;
}

interface UserLivesSectionProps {
  userId: string;
  isOwner?: boolean;
  hideSectionTitle?: boolean;
  onOpenLive?: (liveId: string) => void;
  /** Ouvre la page d'abonnement OnScen+ (profil personnel). */
  onSubscribe?: () => void;
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
        {live.replayPlaybackUrl && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600/90 text-white">
            ▶ {t('profile.lives.replay')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-bold text-white text-sm truncate">{live.title}</p>
        {showHost && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{live.hostName}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{date}</p>
        {live.peakViewersCount != null && live.peakViewersCount > 0 && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            {t('profile.lives.peakViewers', { count: live.peakViewersCount })}
          </p>
        )}
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

function ArchivedLivesLockedState({ onSubscribe }: { onSubscribe?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="py-12 text-center px-4">
      <div
        className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#1a1a26] border border-[#2d2d3d] flex items-center justify-center text-2xl"
        aria-hidden
      >
        🔒
      </div>
      <p className="text-sm font-semibold text-white mb-1">{t('profile.lives.plusRequired')}</p>
      <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto leading-relaxed">
        {t('profile.lives.plusRequiredHint')}
      </p>
      {onSubscribe && (
        <button
          type="button"
          onClick={onSubscribe}
          className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/30 transition active:scale-[0.99]"
        >
          {t('profile.lives.plusRequiredCta')}
        </button>
      )}
    </div>
  );
}

export function UserLivesSection({
  userId,
  isOwner = false,
  hideSectionTitle = false,
  onOpenLive,
  onSubscribe,
}: UserLivesSectionProps) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [lives, setLives] = useState<ArchivedLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerPlanId, setOwnerPlanId] = useState<PlatformPlanId | null>(null);
  const [planLoading, setPlanLoading] = useState(isOwner);

  const plusLocked = isOwner && ownerPlanId !== null && !canAccessArchivedLives(ownerPlanId);

  useEffect(() => {
    if (!isOwner || !token) {
      setOwnerPlanId(null);
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    setPlanLoading(true);
    api
      .getPlatformPlan(token)
      .then((r) => {
        if (!cancelled) setOwnerPlanId(r.plan.id as PlatformPlanId);
      })
      .catch(() => {
        if (!cancelled) setOwnerPlanId('free');
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, token]);

  const loadLives = useCallback(() => {
    if (!token) {
      setLives([]);
      setLoading(false);
      return Promise.resolve();
    }
    if (isOwner && (planLoading || (ownerPlanId !== null && !canAccessArchivedLives(ownerPlanId)))) {
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
  }, [token, userId, isOwner, planLoading, ownerPlanId]);

  useEffect(() => {
    void loadLives();
  }, [loadLives]);

  const sectionTitle = isOwner ? t('profile.lives.myTitle') : t('profile.lives.title');
  const emptyMessage = isOwner ? t('profile.lives.emptyOwner') : t('profile.lives.empty');
  const showLocked = plusLocked && !planLoading;

  return (
    <section className="p-4 max-w-lg mx-auto w-full">
      {!hideSectionTitle && (
        <h2 className="text-sm font-bold text-white mb-3">{sectionTitle}</h2>
      )}

      {planLoading || loading ? (
        <div className="flex justify-center py-12">
          <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      ) : showLocked ? (
        <ArchivedLivesLockedState onSubscribe={onSubscribe} />
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
