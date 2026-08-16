import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { resolveStaffRole } from '../lib/adminStaffRoles';
import { AdminAccountDossier } from '../components/AdminAccountDossier';
import {
  copyText,
  formatRelativeLastSeen,
  isBotEmail,
  platformPlanBadgeClass,
  resolvePlatformPlanLabel,
  statusBadgeClass,
  statusLabel,
  type PlatformPlanId,
} from '../lib/adminAccountsUi';
import type {
  AccessManagedUser,
  AccountStatus,
  AdminUserAuditEntry,
  AdminUserPlanFilter,
  AdminUserSocialResponse,
  AdminUserSort,
  AdminUserStaffFilter,
  StaffRole,
} from '../types';

type UserFilter = 'all' | AccountStatus;

const PAGE_SIZE = 30;
const FILTER_OPTIONS: UserFilter[] = ['all', 'pending', 'active', 'blocked'];

type FeedbackKind = 'success' | 'error';

function showFeedback(
  setFeedback: (value: { message: string; kind: FeedbackKind } | null) => void,
  message: string,
  kind: FeedbackKind
) {
  setFeedback({ message, kind });
  window.setTimeout(() => setFeedback(null), kind === 'error' ? 4000 : 2500);
}

function filterLabel(filter: UserFilter, t: (key: string) => string): string {
  if (filter === 'all') return t('admin.accounts.filterAll');
  if (filter === 'pending') return t('admin.accounts.filterPending');
  if (filter === 'active') return t('admin.accounts.filterActive');
  return t('admin.accounts.filterBlocked');
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

function exportUsersCsv(users: AccessManagedUser[]): void {
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
      u.accountStatus,
      u.city ?? '',
      u.birthDate ?? '',
      u.age ?? '',
      u.relationshipStatus ?? '',
      u.memberSince ?? '',
      u.lastSeenAt ?? '',
      u.followersCount ?? '',
      u.photosCount ?? '',
      u.privateReelsCount ?? '',
      u.publicReelsCount ?? '',
      u.meloCoins ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `onscen-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminAccountsTab() {
  const { token, user: me } = useAuth();
  const myStaffRole = resolveStaffRole(me);
  const canGrantDev = myStaffRole === 'dev';
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
  const [staffFilter, setStaffFilter] = useState<AdminUserStaffFilter>('all');
  const [planFilter, setPlanFilter] = useState<AdminUserPlanFilter>('all');
  const [sort, setSort] = useState<AdminUserSort>('lastSeen');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, AccessManagedUser>>({});
  const [socialById, setSocialById] = useState<Record<string, AdminUserSocialResponse>>({});
  const [socialLoadingId, setSocialLoadingId] = useState<string | null>(null);
  const [auditById, setAuditById] = useState<Record<string, AdminUserAuditEntry[]>>({});
  const [auditAvailableById, setAuditAvailableById] = useState<Record<string, boolean>>({});
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
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
          staff: staffFilter,
          plan: planFilter,
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
    [token, filter, staffFilter, planFilter, debouncedSearch, sort, t]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  const reload = useCallback(async () => {
    await fetchPage(0, false);
  }, [fetchPage]);

  const patchUser = (user: AccessManagedUser) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
    setDetailById((prev) => ({ ...prev, [user.id]: { ...(prev[user.id] ?? user), ...user } }));
  };

  const loadDossierExtras = async (userId: string) => {
    if (!token) return;
    if (!detailById[userId]) {
      try {
        const { user } = await api.getAccessAdminUser(token, userId);
        setDetailById((prev) => ({ ...prev, [userId]: user }));
      } catch {
        // Liste déjà enrichie
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
    setAuditLoadingId(userId);
    try {
      const audit = await api.getAccessAdminUserAudit(token, userId);
      setAuditById((prev) => ({ ...prev, [userId]: audit.entries }));
      setAuditAvailableById((prev) => ({ ...prev, [userId]: audit.available }));
    } catch {
      setAuditAvailableById((prev) => ({ ...prev, [userId]: false }));
    } finally {
      setAuditLoadingId(null);
    }
  };

  const openDossier = (userId: string) => {
    setSelectedId(userId);
    void loadDossierExtras(userId);
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
      const { user } = await api.getAccessAdminUser(token, userId);
      patchUser(user);
      await reload();
      const audit = await api.getAccessAdminUserAudit(token, userId);
      setAuditById((prev) => ({ ...prev, [userId]: audit.entries }));
      setAuditAvailableById((prev) => ({ ...prev, [userId]: audit.available }));
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

  const toggleStaffRole = async (userId: string, role: StaffRole | null) => {
    if (!token) return;
    const confirmKey =
      role === 'dev'
        ? 'admin.accounts.promoteDevConfirm'
        : role === 'admin'
          ? 'admin.accounts.promoteAdminConfirm'
          : 'admin.accounts.demoteConfirm';
    if (!window.confirm(t(confirmKey))) return;
    setBusy(userId);
    try {
      const res = role
        ? await api.promoteAccessUser(token, userId, role)
        : await api.demoteAccessUser(token, userId);
      patchUser(res.user);
      await reload();
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setBusy('');
    }
  };

  const assignPlatformPlan = async (userId: string, planId: PlatformPlanId, username: string) => {
    if (!token) return;
    const planLabel = t(
      planId === 'onscen_ultra'
        ? 'admin.accounts.platformPlanUltra'
        : planId === 'onscen_plus'
          ? 'admin.accounts.platformPlanPlus'
          : 'admin.accounts.platformPlanFree'
    );
    if (!window.confirm(t('admin.accounts.platformPlanAssignConfirm', { plan: planLabel, username }))) {
      return;
    }
    setBusy(userId);
    try {
      const res = await api.assignAdminPlatformPlan(token, userId, planId);
      const nextPlanId = res.status.plan.id as PlatformPlanId;
      const nextPlanLabel = res.status.plan.label;
      const next = { platformPlanId: nextPlanId, platformPlanLabel: nextPlanLabel };
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...next } : u)));
      setDetailById((prev) => {
        const existing = prev[userId];
        if (!existing) return prev;
        return { ...prev, [userId]: { ...existing, ...next } };
      });
      showFeedback(setFeedback, t('admin.accounts.platformPlanAssigned'), 'success');
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setBusy('');
    }
  };

  const revokeSessions = async (userId: string) => {
    if (!token) return;
    setBusy(userId);
    try {
      await api.revokeAccessUserSessions(token, userId);
      const audit = await api.getAccessAdminUserAudit(token, userId);
      setAuditById((prev) => ({ ...prev, [userId]: audit.entries }));
      setAuditAvailableById((prev) => ({ ...prev, [userId]: audit.available }));
      showFeedback(setFeedback, t('admin.accounts.revokeSessionsSuccess'), 'success');
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setBusy('');
    }
  };

  const resendVerification = async (userId: string) => {
    if (!token) return;
    setBusy(userId);
    try {
      const res = await api.resendAccessUserVerification(token, userId);
      patchUser(res.user);
      const audit = await api.getAccessAdminUserAudit(token, userId);
      setAuditById((prev) => ({ ...prev, [userId]: audit.entries }));
      setAuditAvailableById((prev) => ({ ...prev, [userId]: audit.available }));
      showFeedback(setFeedback, t('admin.accounts.resendVerificationSuccess'), 'success');
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    showFeedback(setFeedback, ok ? label : t('admin.accounts.copyFailed'), ok ? 'success' : 'error');
  };

  const handleExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      const result = await api.getAccessAdminUsers(token, {
        status: filter === 'all' ? 'all' : filter,
        q: debouncedSearch || undefined,
        sort,
        staff: staffFilter,
        plan: planFilter,
        limit: 5000,
        offset: 0,
      });
      exportUsersCsv(result.users);
    } catch (e) {
      showFeedback(setFeedback, e instanceof Error ? e.message : t('errors.network'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const hasSearch = search.trim().length > 0;
  const selected = selectedId
    ? (detailById[selectedId] ?? users.find((u) => u.id === selectedId) ?? null)
    : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">{t('admin.accounts.pageLead')}</p>

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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg leading-none w-11 h-11"
            onClick={() => setSearch('')}
            aria-label={t('admin.accounts.clearSearch')}
          >
            ×
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label={t('admin.accounts.filterStatus')}>
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {filterLabel(f, t)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <select
          className="flex-1 min-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm min-h-11"
          value={sort}
          onChange={(e) => setSort(e.target.value as AdminUserSort)}
          aria-label={t('admin.accounts.sortLabel')}
        >
          <option value="lastSeen">{t('admin.accounts.sortLastSeen')}</option>
          <option value="memberSince">{t('admin.accounts.sortMemberSince')}</option>
          <option value="username">{t('admin.accounts.sortUsername')}</option>
          <option value="status">{t('admin.accounts.sortStatus')}</option>
        </select>
        <select
          className="flex-1 min-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm min-h-11"
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value as AdminUserStaffFilter)}
          aria-label={t('admin.accounts.filterStaff')}
        >
          <option value="all">{t('admin.accounts.filterStaffAll')}</option>
          <option value="staff">{t('admin.accounts.filterStaffAny')}</option>
          <option value="admin">{t('admin.accounts.filterStaffAdmin')}</option>
          <option value="dev">{t('admin.accounts.filterStaffDev')}</option>
        </select>
        <select
          className="flex-1 min-w-[8rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm min-h-11"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as AdminUserPlanFilter)}
          aria-label={t('admin.accounts.filterPlan')}
        >
          <option value="all">{t('admin.accounts.filterPlanAll')}</option>
          <option value="free">{t('admin.accounts.platformPlanFree')}</option>
          <option value="onscen_plus">{t('admin.accounts.platformPlanPlus')}</option>
          <option value="onscen_ultra">{t('admin.accounts.platformPlanUltra')}</option>
        </select>
        <button
          type="button"
          disabled={exporting || loading}
          onClick={() => void handleExport()}
          className="min-h-11 px-4 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-xs font-medium hover:border-purple-500/50 disabled:opacity-50"
        >
          {exporting ? t('admin.accounts.exporting') : t('admin.accounts.exportCsv')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        {!loading && (
          <p>
            {debouncedSearch || staffFilter !== 'all' || planFilter !== 'all'
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
          const detail = detailById[u.id] ?? u;
          const planId = (detail.platformPlanId ?? 'free') as PlatformPlanId;
          const planLabel = resolvePlatformPlanLabel(detail, t);
          const isBlocked = detail.accountStatus === 'blocked' || u.accountStatus === 'blocked';
          const isBot = isBotEmail(u.email);
          return (
            <li key={u.id} className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="shrink-0 w-11 h-11 rounded-full bg-[#1a1a26] border border-[#2d2d3d] overflow-hidden flex items-center justify-center text-base"
                  onClick={() => openDossier(u.id)}
                  aria-label={t('admin.accounts.openDossier')}
                >
                  {detail.avatarUrl ? (
                    <img src={detail.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{detail.profileType ? '🎵' : '👤'}</span>
                  )}
                </button>
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openDossier(u.id)}>
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5 flex-wrap">
                        {u.username}
                        {detail.staffRole === 'dev' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 font-bold">
                            DEV
                          </span>
                        ) : detail.staffRole === 'admin' || detail.isAdmin ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 font-bold">
                            ADMIN
                          </span>
                        ) : null}
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${statusBadgeClass(u.accountStatus)}`}>
                        {statusLabel(u.accountStatus, t)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${platformPlanBadgeClass(planId)}`}>
                        {planLabel}
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
                    {isBlocked ? <MetaChip accent="warn">{t('admin.accounts.statusBlocked')}</MetaChip> : null}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                <button
                  type="button"
                  className="min-h-11 px-3 rounded-xl text-[11px] font-semibold bg-purple-600/80"
                  onClick={() => openDossier(u.id)}
                >
                  {t('admin.accounts.openDossier')}
                </button>
                {!detail.isAdmin && detail.accountStatus === 'pending' && (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="min-h-11 px-3 rounded-xl text-[11px] font-semibold bg-green-600/80 disabled:opacity-50"
                    onClick={() => void actOnUser(u.id, 'approve')}
                  >
                    {t('admin.accounts.approve')}
                  </button>
                )}
                {isBlocked && !detail.isAdmin ? (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="min-h-11 px-3 rounded-xl text-[11px] font-semibold bg-green-600/70 border border-green-500/40 disabled:opacity-50"
                    onClick={() => {
                      if (!window.confirm(t('admin.accounts.liftSuspensionConfirm'))) return;
                      void actOnUser(u.id, 'unblock');
                    }}
                  >
                    {t('admin.accounts.unblock')}
                  </button>
                ) : null}
                {!isBlocked && !detail.isAdmin && detail.accountStatus !== 'pending' ? (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    className="min-h-11 px-3 rounded-xl text-[11px] font-semibold bg-red-600/60 border border-red-500/30 disabled:opacity-50"
                    onClick={() => {
                      if (!window.confirm(t('admin.accounts.blockQuickConfirm', { days: 7 }))) return;
                      void actOnUser(u.id, 'block', { days: 7 });
                    }}
                  >
                    {t('admin.accounts.blockQuick7')}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => {
            if (!hasMore || loadingMore) return;
            void fetchPage(users.length, true);
          }}
          className="w-full min-h-11 py-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-medium hover:border-purple-500/50 disabled:opacity-50"
        >
          {loadingMore ? t('app.loading') : t('admin.accounts.loadMore')}
        </button>
      )}

      {selected && token ? (
        <AdminAccountDossier
          token={token}
          user={selected}
          social={socialById[selected.id] ?? null}
          socialLoading={socialLoadingId === selected.id}
          audit={auditById[selected.id] ?? []}
          auditAvailable={auditAvailableById[selected.id] ?? false}
          auditLoading={auditLoadingId === selected.id}
          canGrantDev={canGrantDev}
          busy={busy === selected.id}
          locale={locale}
          onClose={() => setSelectedId(null)}
          onApprove={() => void actOnUser(selected.id, 'approve')}
          onBlock={(opts) => void actOnUser(selected.id, 'block', opts)}
          onUnblock={() => void actOnUser(selected.id, 'unblock')}
          onToggleStaff={(role) => void toggleStaffRole(selected.id, role)}
          onAssignPlan={(planId) => void assignPlatformPlan(selected.id, planId, selected.username)}
          onRevokeSessions={() => void revokeSessions(selected.id)}
          onResendVerification={() => void resendVerification(selected.id)}
          onCopy={(text, label) => void handleCopy(text, label)}
        />
      ) : null}
    </div>
  );
}
