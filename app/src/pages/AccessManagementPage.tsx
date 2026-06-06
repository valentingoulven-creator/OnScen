import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type {
  AccessInviteCode,
  AccessManagedUser,
  AccessRegistrationMode,
  PublicAccessConfig,
} from '../types';

const MODE_LABELS: Record<AccessRegistrationMode, string> = {
  open: 'Ouvertes (tout le monde)',
  invite_only: 'Sur invitation uniquement',
  admin_approval: 'Validation administrateur',
  closed: 'Fermées',
};

const STATUS_LABELS = {
  all: 'Tous',
  pending: 'En attente',
  active: 'Actifs',
  blocked: 'Suspendus',
} as const;

type UserFilter = keyof typeof STATUS_LABELS;

export function AccessManagementPage({ onBack }: { onBack?: () => void }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<AccessRegistrationMode>('admin_approval');
  const [config, setConfig] = useState<PublicAccessConfig | null>(null);
  const [counts, setCounts] = useState({ total: 0, active: 0, pending: 0, blocked: 0 });
  const [invites, setInvites] = useState<AccessInviteCode[]>([]);
  const [users, setUsers] = useState<AccessManagedUser[]>([]);
  const [filter, setFilter] = useState<UserFilter>('pending');
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(5);
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [overview, userList] = await Promise.all([
        api.getAccessAdminOverview(token),
        api.getAccessAdminUsers(token, filter === 'all' ? 'all' : filter),
      ]);
      setPolicy(overview.policy.registrationMode as AccessRegistrationMode);
      setConfig(overview.config);
      setCounts(overview.counts);
      setInvites(overview.inviteCodes);
      setUsers(userList.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger la gestion des accès');
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const savePolicy = async (mode: AccessRegistrationMode) => {
    if (!token) return;
    setBusy('policy');
    try {
      const r = await api.patchAccessPolicy(token, mode);
      setPolicy(r.policy.registrationMode as AccessRegistrationMode);
      setConfig(r.config);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy('');
    }
  };

  const actOnUser = async (userId: string, action: 'approve' | 'block' | 'unblock') => {
    if (!token) return;
    if (action === 'block' && !window.confirm('Suspendre ce compte ? L’utilisateur ne pourra plus se connecter.')) return;
    setBusy(userId);
    try {
      if (action === 'approve') await api.approveAccessUser(token, userId);
      if (action === 'block') await api.blockAccessUser(token, userId);
      if (action === 'unblock') await api.unblockAccessUser(token, userId);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy('');
    }
  };

  const createInvite = async () => {
    if (!token) return;
    setBusy('invite');
    try {
      await api.createAccessInvite(token, {
        label: inviteLabel.trim() || undefined,
        maxUses: inviteMaxUses,
      });
      setInviteLabel('');
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-dvh bg-[#0b0b0f] text-white">
      <header className="sticky top-0 z-10 bg-[#0b0b0f]/95 border-b border-[#1e1e2f] px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="text-purple-400 text-sm">
            ← Retour
          </button>
        )}
        <h1 className="text-lg font-bold">Gestion des accès</h1>
      </header>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {loading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {config && (
          <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-purple-300">Sécurité tunnel public</h2>
            <p className="text-xs text-gray-400">
              {config.enabled
                ? 'Contrôle d’accès actif (ngrok / Internet). Seuls les comptes validés peuvent utiliser l’application.'
                : 'Contrôle d’accès désactivé (usage local uniquement).'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#1a1a26] rounded-xl p-3">
                <div className="text-2xl font-bold text-green-400">{counts.active}</div>
                <div className="text-gray-500">Actifs</div>
              </div>
              <div className="bg-[#1a1a26] rounded-xl p-3">
                <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
                <div className="text-gray-500">En attente</div>
              </div>
            </div>
          </section>
        )}

        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold">Inscriptions</h2>
          <p className="text-xs text-gray-400">Choisissez qui peut créer un compte via l’URL publique.</p>
          <select
            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
            value={policy}
            disabled={busy === 'policy'}
            onChange={(e) => void savePolicy(e.target.value as AccessRegistrationMode)}
          >
            {(Object.keys(MODE_LABELS) as AccessRegistrationMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold">Codes d’invitation</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
              placeholder="Libellé (optionnel)"
              value={inviteLabel}
              onChange={(e) => setInviteLabel(e.target.value)}
            />
            <input
              type="number"
              min={1}
              max={500}
              className="w-20 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-2 py-2 text-sm"
              value={inviteMaxUses}
              onChange={(e) => setInviteMaxUses(Number(e.target.value) || 1)}
            />
          </div>
          <button
            type="button"
            disabled={busy === 'invite'}
            onClick={() => void createInvite()}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50"
          >
            Générer un code
          </button>
          {invites.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun code pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 bg-[#1a1a26] rounded-xl px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-mono text-purple-300">{inv.code}</div>
                    <div className="text-[10px] text-gray-500">
                      {inv.useCount}/{inv.maxUses} utilisations
                      {inv.label ? ` · ${inv.label}` : ''}
                      {inv.disabled ? ' · désactivé' : ''}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-xs text-gray-400 px-2 py-1"
                      onClick={() =>
                        void api
                          .setAccessInviteDisabled(token!, inv.id, !inv.disabled)
                          .then(() => reload())
                      }
                    >
                      {inv.disabled ? 'Activer' : 'Désactiver'}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-400 px-2 py-1"
                      onClick={() => {
                        if (!confirm('Supprimer ce code ?')) return;
                        void api.deleteAccessInvite(token!, inv.id).then(() => reload());
                      }}
                    >
                      Suppr.
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Utilisateurs</h2>
            <select
              className="bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-2 py-1 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value as UserFilter)}
            >
              {(Object.keys(STATUS_LABELS) as UserFilter[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          {users.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun utilisateur dans cette catégorie.</p>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="bg-[#1a1a26] rounded-xl px-3 py-3 text-sm space-y-2">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${
                        u.accountStatus === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : u.accountStatus === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {u.accountStatus === 'active'
                        ? 'Actif'
                        : u.accountStatus === 'pending'
                          ? 'En attente'
                          : 'Suspendu'}
                      {u.isAdmin ? ' · Admin' : ''}
                    </span>
                  </div>
                  {!u.isAdmin && (
                    <div className="flex gap-2">
                      {u.accountStatus === 'pending' && (
                        <button
                          type="button"
                          disabled={busy === u.id}
                          className="flex-1 py-1.5 rounded-lg bg-green-600/80 text-xs"
                          onClick={() => void actOnUser(u.id, 'approve')}
                        >
                          Approuver
                        </button>
                      )}
                      {u.accountStatus !== 'blocked' && u.accountStatus !== 'pending' && (
                        <button
                          type="button"
                          disabled={busy === u.id}
                          className="flex-1 py-1.5 rounded-lg bg-red-600/60 text-xs"
                          onClick={() => void actOnUser(u.id, 'block')}
                        >
                          Suspendre
                        </button>
                      )}
                      {u.accountStatus === 'blocked' && (
                        <button
                          type="button"
                          disabled={busy === u.id}
                          className="flex-1 py-1.5 rounded-lg bg-purple-600/80 text-xs"
                          onClick={() => void actOnUser(u.id, 'unblock')}
                        >
                          Réactiver
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
