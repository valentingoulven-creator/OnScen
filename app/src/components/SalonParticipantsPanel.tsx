import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import { emitOnSocket } from '../lib/socket';
import type { SalonParticipant } from '../types';
import { SalonUserBanModal } from './SalonUserBanModal';
import { UsernameDisplay } from './UsernameDisplay';
import { UserDevBadge } from './UserDevBadge';

interface SalonParticipantsPanelProps {
  salonId: string;
  token: string;
  vipModeratorIds: string[];
  onVipChange?: (userId: string, isVip: boolean) => void | Promise<void>;
  onActionDone?: (message: string) => void;
}

export function SalonParticipantsPanel({
  salonId,
  token,
  vipModeratorIds,
  onVipChange,
  onActionDone,
}: SalonParticipantsPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<SalonParticipant[]>([]);
  const [listenersCount, setListenersCount] = useState(0);
  const [banTarget, setBanTarget] = useState<SalonParticipant | null>(null);
  const [vipSavingId, setVipSavingId] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSalonParticipants(token, salonId);
      setParticipants(res.participants);
      setListenersCount(res.listenersCount);
    } catch (e) {
      onActionDone?.(
        e instanceof Error ? e.message : t('common.error', { defaultValue: 'Erreur' })
      );
    } finally {
      setLoading(false);
    }
  }, [token, salonId, onActionDone, t]);

  useEffect(() => {
    void loadParticipants();
    const id = window.setInterval(() => void loadParticipants(), 12_000);
    return () => window.clearInterval(id);
  }, [loadParticipants]);

  useEffect(() => {
    const vipSet = new Set(vipModeratorIds);
    setParticipants((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((p) => {
        const isVip = vipSet.has(p.id);
        if (p.isVip === isVip) return p;
        changed = true;
        return { ...p, isVip };
      });
      return changed ? next : prev;
    });
  }, [vipModeratorIds]);

  const kickUser = (p: SalonParticipant) => {
    const msg = t('salon.participants.kickConfirm', {
      username: p.username,
      defaultValue: 'Expulser {{username}} du salon ?',
    });
    if (!window.confirm(msg)) return;
    emitOnSocket('salon_kick', { salonId, userId: p.id });
    setParticipants((prev) => prev.filter((x) => x.id !== p.id));
    onActionDone?.(
      t('salon.participants.kicked', { username: p.username, defaultValue: '{{username}} expulsé(e)' })
    );
  };

  const confirmBan = (opts: { permanent: boolean; durationMs?: number }) => {
    if (!banTarget) return;
    emitOnSocket('salon_ban', {
      salonId,
      userId: banTarget.id,
      permanent: opts.permanent,
      durationMs: opts.durationMs,
    });
    setParticipants((prev) => prev.filter((x) => x.id !== banTarget.id));
    onActionDone?.(
      t('salon.participants.banned', {
        username: banTarget.username,
        defaultValue: '{{username}} bloqué(e)',
      })
    );
    setBanTarget(null);
  };

  const toggleVip = async (p: SalonParticipant) => {
    const add = !p.isVip;
    if (!add) {
      const msg = t('salon.participants.removeVipConfirm', {
        username: p.username,
        defaultValue: 'Retirer les droits modérateur de {{username}} ?',
      });
      if (!window.confirm(msg)) return;
    }
    if (!onVipChange) return;

    const previousIsVip = p.isVip;
    setVipSavingId(p.id);
    setParticipants((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, isVip: add } : x))
    );

    try {
      await onVipChange(p.id, add);
      onActionDone?.(
        add
          ? t('salon.participants.vipGranted', {
              username: p.username,
              defaultValue: '{{username}} est modérateur',
            })
          : t('salon.participants.vipRevoked', {
              username: p.username,
              defaultValue: 'Droits retirés pour {{username}}',
            })
      );
    } catch {
      setParticipants((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, isVip: previousIsVip } : x))
      );
    } finally {
      setVipSavingId(null);
    }
  };

  const vipCount = participants.filter((p) => p.isVip).length;

  const countLabel = loading && participants.length === 0
    ? '…'
    : `${participants.length}${listenersCount > 0 ? ` · ${listenersCount} 🎧` : ''}`;

  return (
    <div className="shrink-0 border-b border-[#1e1e2f] bg-[#0d0d14]">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left"
        aria-expanded={!collapsed}
        aria-label={t('salon.participants.open', { defaultValue: 'Participants du salon' })}
      >
        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
          👥 {t('salon.participants.title', { defaultValue: 'Participants' })}
        </span>
        <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{countLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={`shrink-0 text-gray-600 transition-transform duration-150 ${collapsed ? '' : 'rotate-180'}`}
        >
          <polyline
            points="1,3 5,7 9,3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {!collapsed && (
        <div className="max-h-44 overflow-y-auto px-2 pb-2 space-y-1.5">
          {loading && participants.length === 0 ? (
            <p className="text-[11px] text-gray-500 px-1 py-2">
              {t('common.loading', { defaultValue: 'Chargement…' })}
            </p>
          ) : participants.length === 0 ? (
            <p className="text-[11px] text-gray-500 px-1 py-2">
              {t('salon.participants.empty', { defaultValue: 'Aucun participant connecté.' })}
            </p>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-[#1e1e2f] bg-[#101018] px-2 py-1.5 space-y-1"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {p.isDev ? <UserDevBadge className="shrink-0" /> : null}
                  {p.isVip ? (
                    <span
                      className="shrink-0 text-[9px] font-bold text-amber-400"
                      title={t('salon.participants.vipBadge', { defaultValue: 'Modérateur' })}
                    >
                      ⭐
                    </span>
                  ) : null}
                  <UsernameDisplay
                    username={p.username}
                    usernameColor={p.usernameColor}
                    className="text-xs text-gray-200 truncate flex-1 min-w-0"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={vipSavingId === p.id}
                    onClick={() => void toggleVip(p)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-amber-500/30 text-amber-200 hover:bg-amber-950/30 disabled:opacity-50"
                  >
                    {p.isVip
                      ? t('salon.participants.revokeRights', { defaultValue: 'Retirer droits' })
                      : t('salon.participants.grantRights', { defaultValue: 'Droits mod.' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => kickUser(p)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-orange-500/30 text-orange-200 hover:bg-orange-950/30"
                  >
                    {t('salon.participants.kick', { defaultValue: 'Expulser' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBanTarget(p)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-red-500/30 text-red-300 hover:bg-red-950/30"
                  >
                    {t('salon.participants.ban', { defaultValue: 'Bloquer' })}
                  </button>
                </div>
              </div>
            ))
          )}
          {vipCount > 0 && (
            <p className="px-1 py-1 text-[9px] text-gray-600 leading-snug">
              {t('salon.participants.vipHint', {
                defaultValue:
                  'Les modérateurs peuvent expulser et bloquer (sauf autres modérateurs).',
              })}
            </p>
          )}
        </div>
      )}

      {banTarget && (
        <SalonUserBanModal
          username={banTarget.username}
          open
          onClose={() => setBanTarget(null)}
          onConfirm={confirmBan}
        />
      )}
    </div>
  );
}
