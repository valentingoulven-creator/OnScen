import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { AccessManagedUser, AccountStatus } from '../types';

type UserFilter = 'all' | AccountStatus;

function formatDate(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: AccountStatus, t: (key: string) => string): string {
  if (status === 'active') return t('admin.accounts.statusActive');
  if (status === 'pending') return t('admin.accounts.statusPending');
  return t('admin.accounts.statusBlocked');
}

export function AdminAccountsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<AccessManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const userList = await api.getAccessAdminUsers(
        token,
        filter === 'all' ? 'all' : filter,
        debouncedSearch || undefined
      );
      setUsers(userList.users);
      setTotal(userList.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setLoading(false);
    }
  }, [token, filter, debouncedSearch, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm"
          placeholder={t('admin.accounts.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as UserFilter)}
        >
          <option value="all">{t('admin.accounts.filterAll')}</option>
          <option value="pending">{t('admin.accounts.filterPending')}</option>
          <option value="active">{t('admin.accounts.filterActive')}</option>
          <option value="blocked">{t('admin.accounts.filterBlocked')}</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">{t('admin.accounts.counts', { total })}</p>

      {loading && <p className="text-gray-400 text-sm">{t('app.loading')}</p>}
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
          return (
            <li key={u.id} className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl px-3 py-3 text-sm space-y-2">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(expanded ? null : u.id)}
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
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full h-fit shrink-0 ${
                      u.accountStatus === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : u.accountStatus === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {statusLabel(u.accountStatus, t)}
                    {u.isAdmin ? ` · ${t('admin.accounts.adminBadge')}` : ''}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="text-xs text-gray-400 space-y-1 border-t border-[#1e1e2f] pt-2">
                  <p>{t('admin.accounts.memberSince', { date: formatDate(u.memberSince, locale) })}</p>
                  <p>{t('admin.accounts.lastSeen', { date: formatDate(u.lastSeenAt, locale) })}</p>
                  {u.meloCoins != null && (
                    <p>{t('admin.accounts.meloCoins', { count: u.meloCoins })}</p>
                  )}
                  {u.listeningRole && <p>{u.listeningRole}</p>}
                  {u.bioPreview && <p className="italic text-gray-500">{u.bioPreview}</p>}
                </div>
              )}

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
    </div>
  );
}
