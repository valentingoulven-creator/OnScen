import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getProfilePath } from '../lib/profileDeepLink';
import type {
  AccessManagedUser,
  AccountStatus,
  AdminUserSocialResponse,
  AdminUserSort,
} from '../types';

type UserFilter = 'all' | AccountStatus;

const PAGE_SIZE = 30;

type PlatformPlanId = 'free' | 'soundy_plus' | 'soundy_ultra';

const PLATFORM_PLAN_OPTIONS: { id: PlatformPlanId; labelKey: string }[] = [
  { id: 'free', labelKey: 'admin.accounts.platformPlanFree' },
  { id: 'soundy_plus', labelKey: 'admin.accounts.platformPlanPlus' },
  { id: 'soundy_ultra', labelKey: 'admin.accounts.platformPlanUltra' },
];

function formatDate(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatIsoDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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

function statusLabel(status: AccountStatus, t: (key: string) => string): string {
  if (status === 'active') return t('admin.accounts.statusActive');
  if (status === 'pending') return t('admin.accounts.statusPending');
  return t('admin.accounts.statusBlocked');
}

function statusBadgeClass(status: AccountStatus): string {
  if (status === 'active') return 'bg-green-500/20 text-green-400';
  if (status === 'pending') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

function platformPlanBadgeClass(planId: PlatformPlanId | undefined): string {
  if (planId === 'soundy_ultra') return 'bg-amber-500/20 text-amber-300';
  if (planId === 'soundy_plus') return 'bg-purple-500/20 text-purple-300';
  return 'bg-gray-500/20 text-gray-300';
}

function resolvePlatformPlanLabel(
  user: AccessManagedUser,
  t: (key: string) => string
): string {
  if (user.platformPlanLabel) return user.platformPlanLabel;
  const planId = user.platformPlanId ?? 'free';
  const option = PLATFORM_PLAN_OPTIONS.find((p) => p.id === planId);
  return option ? t(option.labelKey) : t('admin.accounts.platformPlanFree');
}

type FeedbackKind = 'success' | 'error';

function showFeedback(
  setFeedback: (value: { message: string; kind: FeedbackKind } | null) => void,
  message: string,
  kind: FeedbackKind
) {
  setFeedback({ message, kind });
  window.setTimeout(() => setFeedback(null), kind === 'error' ? 4000 : 2500);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const BLOCK_DURATION_OPTIONS: { days: number | null; labelKey: string }[] = [
  { days: 1, labelKey: 'admin.accounts.blockDays1' },
  { days: 7, labelKey: 'admin.accounts.blockDays7' },
  { days: 30, labelKey: 'admin.accounts.blockDays30' },
  { days: 90, labelKey: 'admin.accounts.blockDays90' },
  { days: null, labelKey: 'admin.accounts.blockPermanent' },
];

function formatBlockedUntil(ts: number | undefined, locale: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function blockDaysRemaining(blockedUntil: number | undefined): number | null {
  if (!blockedUntil) return null;
  const ms = blockedUntil - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function formatRelativeLastSeen(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return locale.startsWith('en') ? 'just now' : 'à l\'instant';
  if (mins < 60) return locale.startsWith('en') ? `${mins} min ago` : `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return locale.startsWith('en') ? `${hours} h ago` : `il y a ${hours} h`;
  return formatDateTime(ts, locale);
}

function isBotEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith('@bot.local') || lower.includes('@bot.') || lower.includes('bot@');
}

function MetaChip({ children, accent }: { children: ReactNode; accent?: 'warn' | 'purple' }) {
  const cls =
    accent === 'warn'
      ? 'bg-amber-500/15 text-amber-200'
      : accent === 'purple'
        ? 'bg-purple-500/15 text-purple-200'
        : 'bg-[#1a1a26] text-gray-400';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

const FILTER_OPTIONS: UserFilter[] = ['all', 'pending', 'active', 'blocked'];

function filterLabel(filter: UserFilter, t: (key: string) => string): string {
  if (filter === 'all') return t('admin.accounts.filterAll');
  if (filter === 'pending') return t('admin.accounts.filterPending');
  if (filter === 'active') return t('admin.accounts.filterActive');
  return t('admin.accounts.filterBlocked');
}

function relationshipLabel(
  u: AccessManagedUser,
  t: (key: string) => string
): string | undefined {
  if (u.relationshipStatus === 'celibataire') return t('admin.accounts.relationshipCelibataire');
  if (u.relationshipStatus === 'en_couple') return t('admin.accounts.relationshipEnCouple');
  if (u.relationshipStatusCustom) return u.relationshipStatusCustom;
  return undefined;
}

function exportUsersCsv(users: AccessManagedUser[], t: (key: string) => string): void {
  const headers = [
    'id',
    'username',
    'email',
    'status',
    'city',
    'birthDate',
    'age',
    'relationshipStatus',
    'memberSince',
    'lastSeenAt',
    'followers',
    'photos',
    'privateReels',
    'publicReels',
    'meloCoins',
  ];
  const rows = users.map((u) =>
    [
      u.id,
      u.username,
      u.email,
      statusLabel(u.accountStatus, t),
      u.city ?? '',
      u.birthDate ?? '',
      u.age != null ? String(u.age) : '',
      u.relationshipStatus ?? u.relationshipStatusCustom ?? '',
      u.memberSince ? new Date(u.memberSince).toISOString() : '',
      u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : '',
      String(u.followersCount ?? 0),
      String(u.photosCount ?? 0),
      String(u.privateReelsCount ?? 0),
      String(u.publicReelsCount ?? 0),
      String(u.meloCoins ?? ''),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `soundy-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminAccountsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<AccessManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [counts, setCounts] = useState<{
    total: number;
    active: number;
    pending: number;
    blocked: number;
  } | null>(null);
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<AdminUserSort>('lastSeen');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, AccessManagedUser>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; kind: FeedbackKind } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [socialById, setSocialById] = useState<Record<string, AdminUserSocialResponse>>({});
  const [socialLoadingId, setSocialLoadingId] = useState<string | null>(null);
  const [blockDaysById, setBlockDaysById] = useState<Record<string, number | null>>({});
  const [blockReasonById, setBlockReasonById] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!token) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const result = await api.getAccessAdminUsers(token, {
          status: filter === 'all' ? 'all' : filter,
          q: debouncedSearch || undefined,
          sort,
          limit: PAGE_SIZE,
          offset,
        });
        setUsers((prev) => (append ? [...prev, ...result.users] : result.users));
        setTotal(result.total);
        setHasMore(result.hasMore);
        setCounts(result.counts);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('errors.network'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, filter, debouncedSearch, sort, t]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  const reload = useCallback(async () => {
    await fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    void fetchPage(users.length, true);
  };

  const actOnUser = async (
    userId: string,
    action: 'approve' | 'block' | 'unblock',
    blockOpts?: { days?: number | null; reason?: string }
  ) => {
    if (!token) return;
    setBusy(userId);
    try {
      if (action === 'approve') await api.approveAccessUser(token, userId);
      if (action === 'block') await api.blockAccessUser(token, userId, blockOpts);
      if (action === 'unblock') await api.unblockAccessUser(token, userId);
      await reload();
      showFeedback(
        setFeedback,
        action === 'block'
          ? t('admin.accounts.blockedSuccess')
          : action === 'unblock'
            ? t('admin.accounts.unblockedSuccess')
            : t('admin.accounts.approvedSuccess'),
        'success'
      );
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleAdmin = async (userId: string, promote: boolean) => {
    if (!token) return;
    const confirmKey = promote ? 'admin.accounts.promoteConfirm' : 'admin.accounts.demoteConfirm';
    if (!window.confirm(t(confirmKey))) return;
    setBusy(userId);
    try {
      if (promote) await api.promoteAccessUser(token, userId);
      else await api.demoteAccessUser(token, userId);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setBusy('');
    }
  };

  const assignPlatformPlan = async (userId: string, planId: PlatformPlanId, username: string) => {
    if (!token) return;
    const planLabel = t(
      PLATFORM_PLAN_OPTIONS.find((p) => p.id === planId)?.labelKey ?? 'admin.accounts.platformPlanFree'
    );
    if (
      !window.confirm(
        t('admin.accounts.platformPlanAssignConfirm', { plan: planLabel, username })
      )
    ) {
      return;
    }
    setBusy(userId);
    try {
      const res = await api.assignAdminPlatformPlan(token, userId, planId);
      const nextPlanId = res.status.plan.id as PlatformPlanId;
      const nextPlanLabel = res.status.plan.label;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, platformPlanId: nextPlanId, platformPlanLabel: nextPlanLabel }
            : u
        )
      );
      setDetailById((prev) => {
        const existing = prev[userId];
        if (!existing) return prev;
        return {
          ...prev,
          [userId]: {
            ...existing,
            platformPlanId: nextPlanId,
            platformPlanLabel: nextPlanLabel,
          },
        };
      });
      showFeedback(setFeedback, t('admin.accounts.platformPlanAssigned'), 'success');
    } catch (e) {
      showFeedback(
        setFeedback,
        e instanceof Error ? e.message : t('errors.network'),
        'error'
      );
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    showFeedback(
      setFeedback,
      ok ? label : t('admin.accounts.copyFailed'),
      ok ? 'success' : 'error'
    );
  };

  const toggleExpanded = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (!token) return;
    if (!detailById[userId]) {
      setDetailLoadingId(userId);
      try {
        const { user } = await api.getAccessAdminUser(token, userId);
        setDetailById((prev) => ({ ...prev, [userId]: user }));
      } catch {
        // Liste paginée déjà enrichie — le panneau utilise les données locales.
      } finally {
        setDetailLoadingId(null);
      }
    }
    if (!socialById[userId]) {
      setSocialLoadingId(userId);
      try {
        const social = await api.getAccessAdminUserSocial(token, userId);
        setSocialById((prev) => ({ ...prev, [userId]: social }));
      } catch {
        // Social optionnel
      } finally {
        setSocialLoadingId(null);
      }
    }
  };

  const handleExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      const result = await api.getAccessAdminUsers(token, {
        status: filter === 'all' ? 'all' : filter,
        q: debouncedSearch || undefined,
        sort,
        limit: 5000,
        offset: 0,
      });
      exportUsersCsv(result.users, t);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setExporting(false);
    }
  };

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const hasSearch = search.trim().length > 0;

  return (
    <div className="space-y-4">
      {loading && !counts ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center animate-pulse"
            >
              <div className="h-7 bg-[#1e1e2f] rounded mb-2" />
              <div className="h-3 bg-[#1e1e2f] rounded w-2/3 mx-auto" />
            </div>
          ))}
        </div>
      ) : counts ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { key: 'total', value: counts.total, color: 'text-white' },
              { key: 'active', value: counts.active, color: 'text-green-400' },
              { key: 'pending', value: counts.pending, color: 'text-yellow-400' },
              { key: 'blocked', value: counts.blocked, color: 'text-red-400' },
            ] as const
          ).map((stat) => (
            <div key={stat.key} className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                {t(`admin.accounts.stats.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          type="search"
          autoComplete="off"
          className="w-full bg-[#1a1a26] border border-purple-500/40 rounded-2xl pl-4 pr-10 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-purple-400"
          placeholder={t('admin.accounts.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.accounts.searchPlaceholder')}
        />
        {hasSearch && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg leading-none"
            onClick={() => setSearch('')}
            aria-label={t('admin.accounts.clearSearch')}
          >
            ×
          </button>
        )}
      </div>

      <div
        className="flex gap-1 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t('admin.accounts.sortLabel')}
      >
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {filterLabel(f, t)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <select
          className="flex-1 min-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as AdminUserSort)}
          aria-label={t('admin.accounts.sortLabel')}
        >
          <option value="lastSeen">{t('admin.accounts.sortLastSeen')}</option>
          <option value="memberSince">{t('admin.accounts.sortMemberSince')}</option>
          <option value="username">{t('admin.accounts.sortUsername')}</option>
          <option value="status">{t('admin.accounts.sortStatus')}</option>
        </select>
        <button
          type="button"
          disabled={exporting || loading}
          onClick={() => void handleExport()}
          className="px-4 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-xs font-medium hover:border-purple-500/50 disabled:opacity-50"
        >
          {exporting ? t('admin.accounts.exporting') : t('admin.accounts.exportCsv')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        {!loading && (
          <p>
            {debouncedSearch
              ? t('admin.accounts.resultCountFiltered', { shown: users.length, total })
              : t('admin.accounts.resultCount', { shown: users.length, total })}
          </p>
        )}
        {feedback && (
          <span className={feedback.kind === 'error' ? 'text-red-400' : 'text-purple-400'}>
            {feedback.message}
          </span>
        )}
      </div>

      {loading && users.length === 0 && <p className="text-gray-400 text-sm">{t('app.loading')}</p>}
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {!loading && users.length === 0 && (
        <p className="text-xs text-gray-500">{t('admin.accounts.noResults')}</p>
      )}

      <ul className="space-y-2">
        {users.map((u) => {
          const expanded = expandedId === u.id;
          const detail = detailById[u.id] ?? u;
          const social = socialById[u.id];
          const rel = relationshipLabel(detail, t);
          const planId = (detail.platformPlanId ?? 'free') as PlatformPlanId;
          const planLabel = resolvePlatformPlanLabel(detail, t);
          const blockDays = blockDaysById[u.id] ?? 7;
          const blockReason = blockReasonById[u.id] ?? '';
          const isBlocked = detail.accountStatus === 'blocked';
          const blockDaysLeft = blockDaysRemaining(detail.blockedUntil);
          const isBot = isBotEmail(u.email);
          return (
            <li
              key={u.id}
              className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm space-y-2"
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  className="shrink-0 w-10 h-10 rounded-full bg-[#1a1a26] border border-[#2d2d3d] overflow-hidden flex items-center justify-center text-base"
                  onClick={() => void toggleExpanded(u.id)}
                  aria-label={t('admin.accounts.openProfile')}
                >
                  {detail.avatarUrl ? (
                    <img src={detail.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{detail.profileType ? '🎵' : '👤'}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => void toggleExpanded(u.id)}
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5 flex-wrap">
                        {u.username}
                        {detail.isAdmin && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 font-bold">
                            ADMIN
                          </span>
                        )}
                        {isBot && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/25 text-gray-300 font-bold">
                            BOT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5 truncate">
                        {[detail.profileType, u.city, formatRelativeLastSeen(detail.lastSeenAt, locale)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${statusBadgeClass(u.accountStatus)}`}
                      >
                        {statusLabel(u.accountStatus, t)}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${platformPlanBadgeClass(planId)}`}
                      >
                        {planLabel}
                      </span>
                      <span className="text-gray-600 text-xs leading-none" aria-hidden>
                        {expanded ? '▾' : '▸'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <MetaChip accent="purple">
                      {t('admin.accounts.followersShort', { count: detail.followersCount ?? 0 })}
                    </MetaChip>
                    <MetaChip>
                      {t('admin.accounts.followingShort', { count: detail.followingCount ?? 0 })}
                    </MetaChip>
                    {(detail.salonsHosted ?? 0) > 0 && (
                      <MetaChip>
                        {t('admin.accounts.salonsShort', { count: detail.salonsHosted ?? 0 })}
                      </MetaChip>
                    )}
                    {(detail.publicReelsCount ?? 0) + (detail.privateReelsCount ?? 0) > 0 && (
                      <MetaChip>
                        {t('admin.accounts.reelsShort', {
                          count:
                            (detail.publicReelsCount ?? 0) + (detail.privateReelsCount ?? 0),
                        })}
                      </MetaChip>
                    )}
                    {isBlocked && detail.blockedUntil && blockDaysLeft != null && blockDaysLeft > 0 && (
                      <MetaChip accent="warn">
                        {t('admin.accounts.blockDaysLeft', { days: blockDaysLeft })}
                      </MetaChip>
                    )}
                    {isBlocked && !detail.blockedUntil && (
                      <MetaChip accent="warn">{t('admin.accounts.blockedPermanent')}</MetaChip>
                    )}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {!detail.isAdmin && detail.accountStatus === 'pending' && (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-green-600/80 disabled:opacity-50"
                    onClick={() => void actOnUser(u.id, 'approve')}
                  >
                    {t('admin.accounts.approve')}
                  </button>
                )}
                {isBlocked && !detail.isAdmin ? (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-purple-600/80 disabled:opacity-50"
                    onClick={() => void actOnUser(u.id, 'unblock')}
                  >
                    {t('admin.accounts.unblock')}
                  </button>
                ) : (
                  !detail.isAdmin &&
                  detail.accountStatus !== 'pending' && (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-red-600/60 border border-red-500/30 disabled:opacity-50"
                      onClick={() => {
                        if (!window.confirm(t('admin.accounts.blockQuickConfirm', { days: 7 }))) return;
                        void actOnUser(u.id, 'block', { days: 7 });
                      }}
                    >
                      {t('admin.accounts.blockQuick7')}
                    </button>
                  )
                )}
                {detail.adminFlag ? (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-purple-600/30 border border-purple-500/40 disabled:opacity-50"
                    onClick={() => void toggleAdmin(u.id, false)}
                  >
                    {t('admin.accounts.demoteAdmin')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-purple-600/70 disabled:opacity-50"
                    onClick={() => void toggleAdmin(u.id, true)}
                  >
                    {t('admin.accounts.promoteAdmin')}
                  </button>
                )}
                <button
                  type="button"
                  className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-[#1a1a26] border border-[#2d2d3d] hover:border-purple-500/40"
                  onClick={() => window.open(getProfilePath(u.id), '_blank', 'noopener,noreferrer')}
                >
                  {t('admin.accounts.openProfile')}
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-semibold bg-[#1a1a26] border border-[#2d2d3d] hover:border-purple-500/40"
                  onClick={() => void toggleExpanded(u.id)}
                >
                  {expanded ? t('admin.accounts.collapse') : t('admin.accounts.expandDetails')}
                </button>
              </div>

              {expanded && (
                <div className="text-xs text-gray-400 space-y-3 border-t border-[#1e1e2f] pt-3">
                  {detailLoadingId === u.id && (
                    <p className="text-gray-500">{t('app.loading')}</p>
                  )}

                  <section className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t('admin.accounts.sectionActivity')}
                    </p>
                    <p>{t('admin.accounts.memberSince', { date: formatDate(detail.memberSince, locale) })}</p>
                    <p>{t('admin.accounts.lastSeen', { date: formatDateTime(detail.lastSeenAt, locale) })}</p>
                    {detail.listeningRole && (
                      <p>{t('admin.accounts.listeningRole', { role: detail.listeningRole })}</p>
                    )}
                    {(detail.salonsHosted ?? 0) > 0 && (
                      <p>
                        {t('admin.accounts.hostStats', {
                          salons: detail.salonsHosted ?? 0,
                          lives: detail.totalLivesHosted ?? 0,
                          active: detail.activeLivesHosted ?? 0,
                        })}
                      </p>
                    )}
                    {detail.meloCoins != null && (
                      <p>{t('admin.accounts.meloCoins', { count: detail.meloCoins })}</p>
                    )}
                    {detail.emailVerified != null && (
                      <p>
                        {detail.emailVerified
                          ? t('admin.accounts.emailVerified')
                          : t('admin.accounts.emailNotVerified')}
                      </p>
                    )}
                    {detail.stripeConnectReady && (
                      <p className="text-green-400/90">{t('admin.accounts.stripeReady')}</p>
                    )}
                    {(detail.connectedPlatformsCount ?? 0) > 0 && (
                      <p>
                        {t('admin.accounts.connectedPlatforms', {
                          count: detail.connectedPlatformsCount ?? 0,
                        })}
                      </p>
                    )}
                  </section>

                  <section className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t('admin.accounts.sectionProfile')}
                    </p>
                    {rel && <p>{t('admin.accounts.relationship', { status: rel })}</p>}
                    {detail.birthDate && (
                      <p>
                        {t('admin.accounts.birthDate', { date: formatIsoDate(detail.birthDate, locale) })}
                        {detail.hideBirthDateOnProfile && (
                          <span className="ml-1 text-amber-400/80">
                            ({t('admin.accounts.birthDateHidden')})
                          </span>
                        )}
                      </p>
                    )}
                    {(detail.bio || detail.bioPreview) && (
                      <p className="italic text-gray-500">{detail.bio ?? detail.bioPreview}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        className="px-2.5 py-1.5 min-h-[44px] rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                        onClick={() => window.open(getProfilePath(u.id), '_blank', 'noopener,noreferrer')}
                      >
                        {t('admin.accounts.openProfile')}
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1.5 min-h-[44px] rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                        onClick={() => void handleCopy(detail.id, t('admin.accounts.copiedId'))}
                      >
                        {t('admin.accounts.copyId')}
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1.5 min-h-[44px] rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                        onClick={() => void handleCopy(detail.email, t('admin.accounts.copiedEmail'))}
                      >
                        {t('admin.accounts.copyEmail')}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-2 rounded-xl border border-[#1e1e2f] p-2.5 bg-[#0f0f16]/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t('admin.accounts.sectionSocial')}
                    </p>
                    {socialLoadingId === u.id && !social && (
                      <p className="text-gray-500">{t('app.loading')}</p>
                    )}
                    {social && (
                      <>
                        <p className="text-[11px] text-gray-400">
                          {t('admin.accounts.socialCounts', {
                            followers: social.followersTotal,
                            following: social.followingTotal,
                          })}
                        </p>
                        {social.followers.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">
                              {t('admin.accounts.followersListTitle')}
                            </p>
                            <ul className="space-y-1 max-h-28 overflow-y-auto">
                              {social.followers.map((f) => (
                                <li key={f.id} className="flex justify-between gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    className="text-purple-300 hover:underline truncate"
                                    onClick={() =>
                                      window.open(getProfilePath(f.id), '_blank', 'noopener,noreferrer')
                                    }
                                  >
                                    {f.username}
                                  </button>
                                  <span className="text-gray-600 truncate">{f.email}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {social.following.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">
                              {t('admin.accounts.followingListTitle')}
                            </p>
                            <ul className="space-y-1 max-h-28 overflow-y-auto">
                              {social.following.map((f) => (
                                <li key={f.id} className="flex justify-between gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    className="text-purple-300 hover:underline truncate"
                                    onClick={() =>
                                      window.open(getProfilePath(f.id), '_blank', 'noopener,noreferrer')
                                    }
                                  >
                                    {f.username}
                                  </button>
                                  <span className="text-gray-600 truncate">{f.email}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  <section className="space-y-2 rounded-xl border border-purple-500/20 p-2.5 bg-purple-500/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-300/90">
                      {t('admin.accounts.platformPlanSection')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORM_PLAN_OPTIONS.map((plan) => {
                        const isCurrent = (detail.platformPlanId ?? 'free') === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            disabled={busy === u.id || isCurrent}
                            className={`px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-medium border transition disabled:opacity-50 ${
                              isCurrent
                                ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                                : 'bg-[#1a1a26] border-[#2d2d3d] hover:border-purple-500/50'
                            }`}
                            onClick={() => void assignPlatformPlan(u.id, plan.id, u.username)}
                          >
                            {t(plan.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 rounded-xl border border-[#1e1e2f] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t('admin.accounts.sectionModeration')}
                    </p>

                    {!detail.isAdmin && detail.accountStatus === 'pending' && (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="w-full min-h-[44px] py-2 rounded-lg bg-green-600/80 text-xs font-semibold disabled:opacity-50"
                        onClick={() => void actOnUser(u.id, 'approve')}
                      >
                        {t('admin.accounts.approve')}
                      </button>
                    )}

                    {isBlocked ? (
                      <div className="space-y-2">
                        {detail.blockedUntil && (
                          <p className="text-amber-300/90">
                            {t('admin.accounts.blockedUntil', {
                              date: formatBlockedUntil(detail.blockedUntil, locale),
                            })}
                          </p>
                        )}
                        {!detail.blockedUntil && (
                          <p className="text-red-300/90">{t('admin.accounts.blockedPermanent')}</p>
                        )}
                        {detail.blockedReason && (
                          <p className="text-gray-500 italic">
                            {t('admin.accounts.blockReason', { reason: detail.blockedReason })}
                          </p>
                        )}
                        {!detail.isAdmin && (
                          <button
                            type="button"
                            disabled={busy === u.id}
                            className="w-full min-h-[44px] py-2 rounded-lg bg-purple-600/80 text-xs font-semibold disabled:opacity-50"
                            onClick={() => void actOnUser(u.id, 'unblock')}
                          >
                            {t('admin.accounts.unblock')}
                          </button>
                        )}
                      </div>
                    ) : (
                      !detail.isAdmin &&
                      detail.accountStatus !== 'pending' && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-gray-500">{t('admin.accounts.blockHint')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {BLOCK_DURATION_OPTIONS.map((opt) => (
                              <button
                                key={String(opt.days)}
                                type="button"
                                disabled={busy === u.id}
                                className={`px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] border transition disabled:opacity-50 ${
                                  blockDays === opt.days
                                    ? 'bg-red-600/30 border-red-500/50 text-red-200'
                                    : 'bg-[#1a1a26] border-[#2d2d3d] hover:border-red-500/40'
                                }`}
                                onClick={() =>
                                  setBlockDaysById((prev) => ({ ...prev, [u.id]: opt.days }))
                                }
                              >
                                {t(opt.labelKey)}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={blockReason}
                            onChange={(e) =>
                              setBlockReasonById((prev) => ({ ...prev, [u.id]: e.target.value }))
                            }
                            placeholder={t('admin.accounts.blockReasonPlaceholder')}
                            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-gray-600"
                          />
                          <button
                            type="button"
                            disabled={busy === u.id}
                            className="w-full min-h-[44px] py-2 rounded-lg bg-red-600/70 text-xs font-semibold disabled:opacity-50"
                            onClick={() =>
                              void actOnUser(u.id, 'block', {
                                days: blockDays,
                                reason: blockReason.trim() || undefined,
                              })
                            }
                          >
                            {t('admin.accounts.blockConfirmAction')}
                          </button>
                        </div>
                      )
                    )}

                    <div className="flex gap-2 pt-1">
                      {detail.adminFlag ? (
                        <button
                          type="button"
                          disabled={busy === u.id}
                          className="flex-1 min-h-[44px] py-2 rounded-lg bg-purple-600/40 text-xs border border-purple-500/40 disabled:opacity-50"
                          onClick={() => void toggleAdmin(u.id, false)}
                        >
                          {t('admin.accounts.demoteAdmin')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === u.id}
                          className="flex-1 min-h-[44px] py-2 rounded-lg bg-purple-600/80 text-xs disabled:opacity-50"
                          onClick={() => void toggleAdmin(u.id, true)}
                        >
                          {t('admin.accounts.promoteAdmin')}
                        </button>
                      )}
                    </div>
                  </section>

                  <p className="text-[10px] text-gray-600 font-mono truncate">{detail.id}</p>
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
          onClick={loadMore}
          className="w-full py-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-medium hover:border-purple-500/50 disabled:opacity-50"
        >
          {loadingMore ? t('app.loading') : t('admin.accounts.loadMore')}
        </button>
      )}
    </div>
  );
}
