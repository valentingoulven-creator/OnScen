import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getProfilePath } from '../lib/profileDeepLink';
import type {
  AdminContentFilter,
  AdminEventRow,
  AdminLiveRow,
  AdminReelRow,
  AdminSalonRow,
} from '../types';

type ContentSection = 'salons' | 'lives' | 'events' | 'reels';

const PAGE_SIZE = 40;
const FILTER_OPTIONS: AdminContentFilter[] = ['all', 'active', 'blocked'];

function formatDateTime(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function platformLabel(platform: string): string {
  return platform === 'youtube' ? 'YouTube' : 'Spotify';
}

function filterLabel(filter: AdminContentFilter, t: (key: string) => string): string {
  if (filter === 'active') return t('admin.content.filterActive');
  if (filter === 'blocked') return t('admin.content.filterBlocked');
  return t('admin.content.filterAll');
}

function eventTypeLabel(type: string | undefined, t: (key: string) => string): string {
  if (type === 'dance') return t('admin.content.eventTypeDance');
  if (type === 'chant') return t('admin.content.eventTypeChant');
  return t('admin.content.eventTypeOther');
}

interface ActionButtonsProps {
  blocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  onViewUser: () => void;
  onEnterSalon?: () => void;
  busy: boolean;
  t: (key: string) => string;
}

function ActionButtons({
  blocked,
  onBlock,
  onUnblock,
  onDelete,
  onViewUser,
  onEnterSalon,
  busy,
  t,
}: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:flex-wrap">
      {onEnterSalon && (
        <button
          type="button"
          disabled={busy}
          onClick={onEnterSalon}
          className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-purple-600 text-white border border-purple-500/50 sm:order-first"
        >
          {t('admin.content.enterSalon')}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onViewUser}
        className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[#1a1a26] text-purple-300 border border-purple-500/30"
      >
        {t('admin.content.viewUser')}
      </button>
      {blocked ? (
        <button
          type="button"
          disabled={busy}
          onClick={onUnblock}
          className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-green-600/20 text-green-300 border border-green-500/30"
        >
          {t('admin.content.unblock')}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onBlock}
          className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30"
        >
          {t('admin.content.block')}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-red-600/20 text-red-300 border border-red-500/30"
      >
        {t('admin.content.delete')}
      </button>
    </div>
  );
}

interface AdminContentTabProps {
  onOpenSalon?: (salonId: string, salonTitle?: string) => void;
}

export function AdminContentTab({ onOpenSalon }: AdminContentTabProps) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';

  const [section, setSection] = useState<ContentSection>('salons');
  const [filter, setFilter] = useState<AdminContentFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [salons, setSalons] = useState<AdminSalonRow[]>([]);
  const [lives, setLives] = useState<AdminLiveRow[]>([]);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [reels, setReels] = useState<AdminReelRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, blocked: 0, active: 0 });
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (append = false) => {
      if (!token) return;
      const nextOffset = append ? offset + PAGE_SIZE : 0;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const opts = { filter, q: debouncedSearch || undefined, limit: PAGE_SIZE, offset: nextOffset };
        if (section === 'salons') {
          const res = await api.getAdminSalons(token, opts);
          setSalons((prev) => (append ? [...prev, ...(res.salons ?? [])] : res.salons ?? []));
          setCounts(res.counts);
          setHasMore(res.hasMore);
          setOffset(nextOffset);
        } else if (section === 'lives') {
          const res = await api.getAdminLives(token, opts);
          setLives((prev) => (append ? [...prev, ...(res.lives ?? [])] : res.lives ?? []));
          setCounts(res.counts);
          setHasMore(res.hasMore);
          setOffset(nextOffset);
        } else if (section === 'events') {
          const res = await api.getAdminEvents(token, opts);
          setEvents((prev) => (append ? [...prev, ...(res.events ?? [])] : res.events ?? []));
          setCounts(res.counts);
          setHasMore(res.hasMore);
          setOffset(nextOffset);
        } else {
          const res = await api.getAdminReels(token, opts);
          setReels((prev) => (append ? [...prev, ...(res.reels ?? [])] : res.reels ?? []));
          setCounts(res.counts);
          setHasMore(res.hasMore);
          setOffset(nextOffset);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('admin.content.loadError'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, section, filter, debouncedSearch, offset, t]
  );

  useEffect(() => {
    setOffset(0);
    setExpandedId(null);
    void load(false);
  }, [section, filter, debouncedSearch, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.content.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  const sections: { id: ContentSection; label: string }[] = [
    { id: 'salons', label: t('admin.content.sectionSalons') },
    { id: 'lives', label: t('admin.content.sectionLives') },
    { id: 'events', label: t('admin.content.sectionEvents') },
    { id: 'reels', label: t('admin.content.sectionReels') },
  ];

  const listCount =
    section === 'salons'
      ? salons.length
      : section === 'lives'
        ? lives.length
        : section === 'events'
          ? events.length
          : reels.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold">{t('admin.content.title')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('admin.content.subtitle')}</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1" aria-label={t('admin.content.title')}>
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
              section === item.id
                ? 'bg-purple-600/80 text-white'
                : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="px-2 py-0.5 rounded-full bg-[#1a1a26] text-gray-400">
          {t('admin.content.statsTotal', { count: counts.total })}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
          {t('admin.content.statsActive', { count: counts.active })}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
          {t('admin.content.statsBlocked', { count: counts.blocked })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.content.searchPlaceholder')}
          className="w-full bg-[#12121a] border border-[#1e1e2f] rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600"
        />
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold ${
                filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-500'
              }`}
            >
              {filterLabel(f, t)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">{t('app.loading')}</p>
      ) : listCount === 0 ? (
        <p className="text-sm text-gray-500">{t('admin.content.noResults')}</p>
      ) : (
        <>
          <p className="text-[10px] text-gray-600">
            {t('admin.content.resultCount', { shown: listCount, total: counts.total })}
          </p>
          <ul className="space-y-2">
            {section === 'salons' &&
              salons.map((s) => {
                const expanded = expandedId === s.id;
                const busy = busyId === s.id;
                const creatorId = s.creator?.id ?? s.hostId;
                return (
                  <li
                    key={s.id}
                    className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                      >
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.title}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {s.hostName} · {platformLabel(s.platform)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {s.adminBlocked && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                {t('admin.content.statusBlocked')}
                              </span>
                            )}
                            {s.isLive && !s.adminBlocked && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/30 text-red-300">
                                LIVE
                              </span>
                            )}
                            <span
                              className="text-gray-600 text-xs leading-none mt-0.5"
                              aria-hidden
                            >
                              {expanded ? '▾' : '▸'}
                            </span>
                          </div>
                        </div>
                      </button>
                      {onOpenSalon && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onOpenSalon(s.id, s.title)}
                          className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold bg-purple-600 text-white border border-purple-500/50 self-center"
                        >
                          {t('admin.content.enterSalon')}
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e2f] text-xs text-gray-400 space-y-1.5">
                        <p>{t('admin.content.platform')}: {platformLabel(s.platform)}</p>
                        <p>{t('admin.content.access')}: {s.accessMode === 'public' ? t('admin.content.accessPublic') : t('admin.content.accessInvite')}{s.allowedCount != null ? ` (${s.allowedCount})` : ''}</p>
                        <p>{t('admin.content.listeners')}: {s.listenersCount}</p>
                        <p>{t('admin.content.track')}: {s.currentTrack.title} — {s.currentTrack.artist}{s.currentTrack.isPlaying ? ' ▶' : ' ⏸'}</p>
                        <p>{t('admin.content.createdAt')}: {formatDateTime(s.createdAt, locale)}</p>
                        {(s.isGhostMode || s.hostGhostMode) && (
                          <p className="text-amber-400/90">{t('admin.content.ghostMode')}</p>
                        )}
                        {s.city && <p>{t('admin.content.city')}: {s.city}</p>}
                        <p className="text-[10px] text-gray-600 font-mono truncate">{s.id}</p>
                        {s.creator && (
                          <p>
                            {t('admin.content.creator')}: {s.creator.username} ({s.creator.email})
                          </p>
                        )}
                        <ActionButtons
                          blocked={s.adminBlocked}
                          busy={busy}
                          t={t}
                          onEnterSalon={
                            onOpenSalon
                              ? () => onOpenSalon(s.id, s.title)
                              : undefined
                          }
                          onViewUser={() => window.open(getProfilePath(creatorId), '_blank', 'noopener,noreferrer')}
                          onBlock={() => {
                            if (!token || !window.confirm(t('admin.content.blockSalonConfirm'))) return;
                            void runAction(s.id, () => api.adminBlockSalon(token, s.id).then(() => undefined));
                          }}
                          onUnblock={() => {
                            if (!token) return;
                            void runAction(s.id, () => api.adminUnblockSalon(token, s.id).then(() => undefined));
                          }}
                          onDelete={() => {
                            if (!token || !window.confirm(t('admin.content.deleteSalonConfirm'))) return;
                            void runAction(s.id, () => api.adminDeleteSalon(token, s.id).then(() => undefined));
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}

            {section === 'lives' &&
              lives.map((l) => {
                const expanded = expandedId === l.id;
                const busy = busyId === l.id;
                const creatorId = l.creator?.id ?? l.hostId;
                return (
                  <li
                    key={l.id}
                    className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm"
                  >
                    <button type="button" className="w-full text-left" onClick={() => setExpandedId(expanded ? null : l.id)}>
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{l.title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {l.hostName} · {platformLabel(l.platform)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {l.adminBlocked && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                              {t('admin.content.statusBlocked')}
                            </span>
                          )}
                          {l.isActive && !l.adminBlocked && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/30 text-red-300">
                              {t('admin.content.statusLive')}
                            </span>
                          )}
                          <span className="text-gray-600 text-xs leading-none mt-0.5" aria-hidden>
                            {expanded ? '▾' : '▸'}
                          </span>
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e2f] text-xs text-gray-400 space-y-1.5">
                        <p>{t('admin.content.viewers')}: {l.viewersCount}</p>
                        <p>{t('admin.content.startedAt')}: {formatDateTime(l.startedAt, locale)}</p>
                        {l.salonTitle && <p>{t('admin.content.linkedSalon')}: {l.salonTitle}</p>}
                        <p>{t('admin.content.track')}: {l.currentTrack.title} — {l.currentTrack.artist}</p>
                        {l.cameraActive && (
                          <p>{t('admin.content.camera')}: {l.cameraMode === 'file' ? t('admin.content.cameraFile') : t('admin.content.cameraLive')}</p>
                        )}
                        {l.hostGhostMode && <p className="text-amber-400/90">{t('admin.content.ghostMode')}</p>}
                        {l.city && <p>{t('admin.content.city')}: {l.city}</p>}
                        <p className="text-[10px] text-gray-600 font-mono truncate">{l.id}</p>
                        {l.creator && (
                          <p>
                            {t('admin.content.creator')}: {l.creator.username} ({l.creator.email})
                          </p>
                        )}
                        <ActionButtons
                          blocked={l.adminBlocked}
                          busy={busy}
                          t={t}
                          onViewUser={() => window.open(getProfilePath(creatorId), '_blank', 'noopener,noreferrer')}
                          onBlock={() => {
                            if (!token || !window.confirm(t('admin.content.blockLiveConfirm'))) return;
                            void runAction(l.id, () => api.adminBlockLive(token, l.id).then(() => undefined));
                          }}
                          onUnblock={() => {
                            if (!token) return;
                            void runAction(l.id, () => api.adminUnblockLive(token, l.id).then(() => undefined));
                          }}
                          onDelete={() => {
                            if (!token || !window.confirm(t('admin.content.deleteLiveConfirm'))) return;
                            void runAction(l.id, () => api.adminDeleteLive(token, l.id).then(() => undefined));
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}

            {section === 'events' &&
              events.map((ev) => {
                const expanded = expandedId === ev.id;
                const busy = busyId === ev.id;
                const creatorId = ev.creator?.id ?? ev.userId;
                return (
                  <li
                    key={ev.id}
                    className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm"
                  >
                    <button type="button" className="w-full text-left" onClick={() => setExpandedId(expanded ? null : ev.id)}>
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-2">{ev.content || t('admin.content.noTitle')}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {ev.creator?.username ?? '—'}
                            {ev.eventLocation ? ` · ${ev.eventLocation}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {ev.adminBlocked && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 h-fit">
                              {t('admin.content.statusBlocked')}
                            </span>
                          )}
                          <span className="text-gray-600 text-xs leading-none mt-0.5" aria-hidden>
                            {expanded ? '▾' : '▸'}
                          </span>
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e2f] text-xs text-gray-400 space-y-1.5">
                        <p>{t('admin.content.eventDate')}: {formatEventDate(ev.eventDate, locale)}</p>
                        {ev.eventLocation && <p>{t('admin.content.location')}: {ev.eventLocation}</p>}
                        <p>{t('admin.content.eventType')}: {eventTypeLabel(ev.eventType, t)}</p>
                        <p>{t('admin.content.likes')}: {ev.likeCount} · {t('admin.content.comments')}: {ev.commentCount}</p>
                        {(ev.hasImage || ev.hasVideo) && (
                          <p>{t('admin.content.media')}: {[ev.hasImage && 'image', ev.hasVideo && 'vidéo'].filter(Boolean).join(', ')}</p>
                        )}
                        <p>{t('admin.content.publishedAt')}: {formatDateTime(ev.createdAt, locale)}</p>
                        <p className="text-[10px] text-gray-600 font-mono truncate">{ev.id}</p>
                        {ev.creator && (
                          <p>
                            {t('admin.content.creator')}: {ev.creator.username} ({ev.creator.email})
                          </p>
                        )}
                        <ActionButtons
                          blocked={ev.adminBlocked}
                          busy={busy}
                          t={t}
                          onViewUser={() => window.open(getProfilePath(creatorId), '_blank', 'noopener,noreferrer')}
                          onBlock={() => {
                            if (!token || !window.confirm(t('admin.content.blockEventConfirm'))) return;
                            void runAction(ev.id, () => api.adminBlockEvent(token, ev.id).then(() => undefined));
                          }}
                          onUnblock={() => {
                            if (!token) return;
                            void runAction(ev.id, () => api.adminUnblockEvent(token, ev.id).then(() => undefined));
                          }}
                          onDelete={() => {
                            if (!token || !window.confirm(t('admin.content.deleteEventConfirm'))) return;
                            void runAction(ev.id, () => api.adminDeleteEvent(token, ev.id).then(() => undefined));
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}

            {section === 'reels' &&
              reels.map((reel) => {
                const expanded = expandedId === reel.id;
                const busy = busyId === reel.id;
                const creatorId = reel.creator?.id ?? reel.authorId;
                return (
                  <li
                    key={reel.id}
                    className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedId(expanded ? null : reel.id)}
                    >
                      <div className="flex gap-3">
                        {reel.posterUrl ? (
                          <img
                            src={reel.posterUrl}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#1a1a26]"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg shrink-0 bg-[#1a1a26] flex items-center justify-center text-[10px] text-gray-600">
                            —
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium line-clamp-2">{reel.caption || reel.title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {reel.creator?.username ?? '—'}
                            {' · '}
                            {formatDateTime(reel.createdAt, locale)}
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {t('admin.content.reelViews', { count: reel.viewCount })}
                            {' · '}
                            {t('admin.content.reelLikes', { count: reel.heartCount })}
                            {reel.isPrivate && (
                              <span className="ml-1 text-amber-400/90">
                                · {t('admin.content.reelPrivate')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {reel.adminBlocked && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                              {t('admin.content.statusBlocked')}
                            </span>
                          )}
                          <span className="text-gray-600 text-xs leading-none mt-0.5" aria-hidden>
                            {expanded ? '▾' : '▸'}
                          </span>
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e2f] text-xs text-gray-400 space-y-1.5">
                        <p>{t('admin.content.reelGenre')}: {reel.genre || '—'}</p>
                        <p>
                          {t('admin.content.reelStats')}: {t('admin.content.reelViews', { count: reel.viewCount })}
                          {' · '}
                          {t('admin.content.reelLikes', { count: reel.heartCount })}
                          {' · '}
                          {t('admin.content.comments')}: {reel.commentCount}
                        </p>
                        {reel.posterUrl && (
                          <a
                            href={reel.posterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:underline"
                          >
                            {t('admin.content.reelThumbnail')}
                          </a>
                        )}
                        <p>{t('admin.content.publishedAt')}: {formatDateTime(reel.createdAt, locale)}</p>
                        <p className="text-[10px] text-gray-600 font-mono truncate">{reel.id}</p>
                        {reel.creator && (
                          <p>
                            {t('admin.content.creator')}: {reel.creator.username} ({reel.creator.email})
                          </p>
                        )}
                        <ActionButtons
                          blocked={reel.adminBlocked}
                          busy={busy}
                          t={t}
                          onViewUser={() =>
                            window.open(getProfilePath(creatorId), '_blank', 'noopener,noreferrer')
                          }
                          onBlock={() => {
                            if (!token || !window.confirm(t('admin.content.blockReelConfirm'))) return;
                            void runAction(reel.id, () =>
                              api.adminBlockReel(token, reel.id).then(() => undefined)
                            );
                          }}
                          onUnblock={() => {
                            if (!token) return;
                            void runAction(reel.id, () =>
                              api.adminUnblockReel(token, reel.id).then(() => undefined)
                            );
                          }}
                          onDelete={() => {
                            if (!token || !window.confirm(t('admin.content.deleteReelConfirm'))) return;
                            void runAction(reel.id, () =>
                              api.adminDeleteReel(token, reel.id).then(() => undefined)
                            );
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>

          {hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void load(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#1a1a26] text-purple-300 border border-purple-500/20"
            >
              {loadingMore ? t('app.loading') : t('admin.content.loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
