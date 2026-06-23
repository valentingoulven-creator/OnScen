import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getProfilePath } from '../lib/profileDeepLink';
import type { AccessManagedUser, AccountStatus, AdminUserSort } from '../types';

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

  const actOnUser = async (userId: string, action: 'approve' | 'block' | 'unblock') => {
    if (!token) return;
    if (action === 'block' && !window.confirm(t('admin.accounts.blockConfirm'))) return;
    setBusy(userId);
    try {
      if (action === 'approve') await api.approveAccessUser(token, userId);
      if (action === 'block') await api.blockAccessUser(token, userId);
      if (action === 'unblock') await api.unblockAccessUser(token, userId);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('errors.network'));
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
    if (!token || detailById[userId]) return;
    setDetailLoadingId(userId);
    try {
      const { user } = await api.getAccessAdminUser(token, userId);
      setDetailById((prev) => ({ ...prev, [userId]: user }));
    } catch {
      // Liste paginée déjà enrichie — le panneau utilise les données locales.
    } finally {
      setDetailLoadingId(null);
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
          const rel = relationshipLabel(detail, t);
          const planId = (detail.platformPlanId ?? 'free') as PlatformPlanId;
          const planLabel = resolvePlatformPlanLabel(detail, t);
          return (
            <li
              key={u.id}
              className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm space-y-2"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => void toggleExpanded(u.id)}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.username}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                    {(u.city || u.profileType) && (
                      <div className="text-[10px] text-gray-600 mt-0.5 truncate">
                        {[u.profileType, u.city].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${statusBadgeClass(u.accountStatus)}`}
                    >
                      {statusLabel(u.accountStatus, t)}
                      {u.isAdmin ? ` · ${t('admin.accounts.adminBadge')}` : ''}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${platformPlanBadgeClass(planId)}`}
                      title={t('admin.accounts.platformPlan', { plan: planLabel })}
                    >
                      {planLabel}
                    </span>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="text-xs text-gray-400 space-y-2 border-t border-[#1e1e2f] pt-2">
                  {detailLoadingId === u.id && (
                    <p className="text-gray-500">{t('app.loading')}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusBadgeClass(detail.accountStatus)}`}>
                      {statusLabel(detail.accountStatus, t)}
                    </span>
                    {detail.isAdmin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
                        {t('admin.accounts.adminBadge')}
                      </span>
                    )}
                    {detail.isGhostMode && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-500/20 text-gray-300">
                        {t('admin.accounts.ghostMode')}
                      </span>
                    )}
                    {(detail.privateReelsCount ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                        {t('admin.accounts.privateReels', { count: detail.privateReelsCount ?? 0 })}
                      </span>
                    )}
                  </div>
                  <p>{t('admin.accounts.memberSince', { date: formatDate(detail.memberSince, locale) })}</p>
                  <p>{t('admin.accounts.lastSeen', { date: formatDateTime(detail.lastSeenAt, locale) })}</p>
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
                  {detail.age != null && !detail.birthDate && (
                    <p>{t('admin.accounts.age', { age: detail.age })}</p>
                  )}
                  {rel && <p>{t('admin.accounts.relationship', { status: rel })}</p>}
                  <p>
                    {t('admin.accounts.followersCount', { count: detail.followersCount ?? 0 })}
                    {' · '}
                    {t('admin.accounts.photosCount', { count: detail.photosCount ?? 0 })}
                    {(detail.publicReelsCount ?? 0) > 0 && (
                      <>
                        {' · '}
                        {t('admin.accounts.publicReels', { count: detail.publicReelsCount ?? 0 })}
                      </>
                    )}
                  </p>
                  {detail.meloCoins != null && (
                    <p>{t('admin.accounts.meloCoins', { count: detail.meloCoins })}</p>
                  )}
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-500">{t('admin.accounts.platformPlanSection')} :</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${platformPlanBadgeClass(planId)}`}
                    >
                      {planLabel}
                    </span>
                  </p>
                  {detail.listeningRole && <p>{detail.listeningRole}</p>}
                  {(detail.bio || detail.bioPreview) && (
                    <p className="italic text-gray-500">{detail.bio ?? detail.bioPreview}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                      onClick={() => window.open(getProfilePath(u.id), '_blank', 'noopener,noreferrer')}
                    >
                      {t('admin.accounts.openProfile')}
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                      onClick={() => void handleCopy(detail.id, t('admin.accounts.copiedId'))}
                    >
                      {t('admin.accounts.copyId')}
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] hover:border-purple-500/50"
                      onClick={() => void handleCopy(detail.email, t('admin.accounts.copiedEmail'))}
                    >
                      {t('admin.accounts.copyEmail')}
                    </button>
                  </div>
                  <div className="pt-2 space-y-2 border border-purple-500/20 rounded-xl p-2.5 bg-purple-500/5">
                    <p className="text-[10px] font-bold text-purple-300/90 uppercase tracking-wider">
                      {t('admin.accounts.platformPlanSection')}
                    </p>
                    <p className="text-[10px] text-gray-500">{t('admin.accounts.platformPlanManageHint')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORM_PLAN_OPTIONS.map((plan) => {
                        const isCurrent = (detail.platformPlanId ?? 'free') === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            disabled={busy === u.id || isCurrent}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition disabled:opacity-50 ${
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
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {u.adminFlag ? (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="flex-1 py-1.5 rounded-lg bg-purple-600/40 text-xs border border-purple-500/40 disabled:opacity-50"
                    onClick={() => void toggleAdmin(u.id, false)}
                  >
                    {t('admin.accounts.demoteAdmin')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="flex-1 py-1.5 rounded-lg bg-purple-600/80 text-xs disabled:opacity-50"
                    onClick={() => void toggleAdmin(u.id, true)}
                  >
                    {t('admin.accounts.promoteAdmin')}
                  </button>
                )}
              </div>

              {!u.isAdmin && (
                <div className="flex gap-2">
                  {u.accountStatus === 'pending' && (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      className="flex-1 py-1.5 rounded-lg bg-green-600/80 text-xs disabled:opacity-50"
                      onClick={() => void actOnUser(u.id, 'approve')}
                    >
                      {t('admin.accounts.approve')}
                    </button>
                  )}
                  {u.accountStatus !== 'blocked' && u.accountStatus !== 'pending' && (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      className="flex-1 py-1.5 rounded-lg bg-red-600/60 text-xs disabled:opacity-50"
                      onClick={() => void actOnUser(u.id, 'block')}
                    >
                      {t('admin.accounts.block')}
                    </button>
                  )}
                  {u.accountStatus === 'blocked' && (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      className="flex-1 py-1.5 rounded-lg bg-purple-600/80 text-xs disabled:opacity-50"
                      onClick={() => void actOnUser(u.id, 'unblock')}
                    >
                      {t('admin.accounts.unblock')}
                    </button>
                  )}
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

      {loading && !counts ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2 border-t border-[#1e1e2f]">
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
      ) : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2 border-t border-[#1e1e2f]">
        {(
          [
            { key: 'total', value: counts?.total ?? 0, color: 'text-white' },
            { key: 'active', value: counts?.active ?? 0, color: 'text-green-400' },
            { key: 'pending', value: counts?.pending ?? 0, color: 'text-yellow-400' },
            { key: 'blocked', value: counts?.blocked ?? 0, color: 'text-red-400' },
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
      )}
    </div>
  );
}
