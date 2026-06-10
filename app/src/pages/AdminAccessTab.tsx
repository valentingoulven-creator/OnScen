import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { AccessInviteCode, AccessRegistrationMode, PublicAccessConfig } from '../types';

export function AdminAccessTab() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<AccessRegistrationMode>('admin_approval');
  const [config, setConfig] = useState<PublicAccessConfig | null>(null);
  const [counts, setCounts] = useState({ total: 0, active: 0, pending: 0, blocked: 0 });
  const [invites, setInvites] = useState<AccessInviteCode[]>([]);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(5);
  const [busy, setBusy] = useState('');

  const modeLabels: Record<AccessRegistrationMode, string> = {
    open: t('admin.access.modeOpen'),
    invite_only: t('admin.access.modeInviteOnly'),
    admin_approval: t('admin.access.modeAdminApproval'),
    closed: t('admin.access.modeClosed'),
  };

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const overview = await api.getAccessAdminOverview(token);
      setPolicy(overview.policy.registrationMode as AccessRegistrationMode);
      setConfig(overview.config);
      setCounts(overview.counts);
      setInvites(overview.inviteCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

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
      alert(e instanceof Error ? e.message : t('errors.network'));
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
      alert(e instanceof Error ? e.message : t('errors.network'));
    } finally {
      setBusy('');
    }
  };

  if (loading && !config) {
    return <p className="text-gray-400 text-sm">{t('app.loading')}</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {config && (
        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-purple-300">{t('admin.access.tunnelTitle')}</h2>
          <p className="text-xs text-gray-400">
            {config.enabled ? t('admin.access.tunnelEnabled') : t('admin.access.tunnelDisabled')}
          </p>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-[#1a1a26] rounded-xl p-3">
              <div className="text-2xl font-bold text-green-400">{counts.active}</div>
              <div className="text-gray-500">{t('admin.accounts.filterActive')}</div>
            </div>
            <div className="bg-[#1a1a26] rounded-xl p-3">
              <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
              <div className="text-gray-500">{t('admin.accounts.filterPending')}</div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold">{t('admin.access.registrations')}</h2>
        <p className="text-xs text-gray-400">{t('admin.access.registrationsHint')}</p>
        <select
          className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
          value={policy}
          disabled={busy === 'policy'}
          onChange={(e) => void savePolicy(e.target.value as AccessRegistrationMode)}
        >
          {(Object.keys(modeLabels) as AccessRegistrationMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {modeLabels[mode]}
            </option>
          ))}
        </select>
      </section>

      <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold">{t('admin.access.invites')}</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm"
            placeholder={t('admin.access.inviteLabel')}
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
          {t('admin.access.generateCode')}
        </button>
        {invites.length === 0 ? (
          <p className="text-xs text-gray-500">{t('admin.access.noInvites')}</p>
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
                    {inv.useCount}/{inv.maxUses}
                    {inv.label ? ` · ${inv.label}` : ''}
                    {inv.disabled ? ' · off' : ''}
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
                    {inv.disabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-400 px-2 py-1"
                    onClick={() => {
                      if (!confirm('Delete?')) return;
                      void api.deleteAccessInvite(token!, inv.id).then(() => reload());
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
