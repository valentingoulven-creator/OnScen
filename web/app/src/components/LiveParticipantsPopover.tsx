import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPopoverPosition } from '../hooks/useAnchoredPopoverPosition';
import { useVisibleInterval } from '../hooks/usePageVisible';
import { api } from '../lib/api';
import type { LiveParticipant } from '../types';
import { UsernameDisplay } from './UsernameDisplay';
import { UserDevBadge } from './UserDevBadge';

interface LiveParticipantsPopoverProps {
  liveId: string;
  token: string;
  hostId: string;
  hostName: string;
  hostUsernameColor?: string;
  vipModeratorIds: string[];
  /** Compteur temps réel (socket live_updated), prioritaire sur la réponse API. */
  viewersCount?: number;
  /** @deprecated Prefer auto flip via portal; kept for callers passing panelAbove. */
  panelAbove?: boolean;
  /** Hôte + live LiveKit sans duo actif : affiche « Inviter en duo » par participant. */
  canInviteDuo?: boolean;
  /** userId du co-hôte actif (masque l'invite pour lui, affiche « Duo actif »). */
  coHostId?: string;
  /** userId ciblé par une invitation en attente (affiche « Invité… » + annuler). */
  coHostInviteTargetId?: string;
  onInviteDuo?: (userId: string) => void;
  onCancelDuoInvite?: () => void;
}

export function LiveParticipantsPopover({
  liveId,
  token,
  hostId: _hostId,
  hostName,
  hostUsernameColor,
  vipModeratorIds,
  viewersCount: viewersCountProp,
  panelAbove = false,
  canInviteDuo = false,
  coHostId,
  coHostInviteTargetId,
  onInviteDuo,
  onCancelDuoInvite,
}: LiveParticipantsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [viewersCountApi, setViewersCountApi] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const viewersCount = viewersCountProp ?? viewersCountApi;

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getLiveParticipants(token, liveId);
      setParticipants(res.participants);
      setViewersCountApi(res.viewersCount);
    } catch {
      /* ignore — liste vide */
    } finally {
      setLoading(false);
    }
  }, [token, liveId]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }
    void loadParticipants();
    searchInputRef.current?.focus();
  }, [open, loadParticipants]);

  useVisibleInterval(() => void loadParticipants(), 12_000, open);

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

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const spectatorLabel =
    viewersCount === 1 ? '1 spectateur' : `${viewersCount} spectateurs`;

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const filteredParticipants = useMemo(() => {
    if (!searchTrimmed) return participants;
    return participants.filter((p) => p.username.toLowerCase().includes(searchTrimmed));
  }, [participants, searchTrimmed]);

  const showHost =
    !searchTrimmed || hostName.toLowerCase().includes(searchTrimmed);

  const panelPos = useAnchoredPopoverPosition(open, buttonRef, panelRef, [
    loading,
    participants.length,
    searchTrimmed,
    filteredParticipants.length,
    showHost,
  ], { estimatedWidth: 288, estimatedHeight: 280, preferAbove: panelAbove });

  const panel =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        className="fixed z-[70] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-2xl overflow-hidden"
        style={{
          top: panelPos?.top ?? (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
          left: panelPos?.left ?? 8,
          visibility: panelPos ? 'visible' : 'hidden',
        }}
      >
          <div className="px-3 py-2 border-b border-[#1e1e2f] bg-[#14141c]/90 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500 tabular-nums min-w-0 truncate">
                {loading ? 'Chargement…' : spectatorLabel}
              </p>
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest shrink-0">
                Participants
              </p>
            </div>
            <div className="relative">
              <span
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"
                aria-hidden
              >
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un participant…"
                autoComplete="off"
                aria-label="Rechercher un participant"
                className="w-full h-8 pl-7 pr-7 text-xs rounded-lg bg-[#1a1a26] border border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500/60 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-base leading-none px-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Effacer la recherche"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2 space-y-1.5">
            {showHost && (
              <div className="rounded-lg border border-[#1e1e2f] bg-[#0f0f16] px-2 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-[9px] font-bold text-red-400">Hôte</span>
                  <UsernameDisplay
                    username={hostName}
                    usernameColor={hostUsernameColor}
                    className="text-xs text-gray-200 truncate flex-1 min-w-0"
                  />
                </div>
              </div>
            )}

            {loading && participants.length === 0 ? (
              <p className="text-[11px] text-gray-500 px-1 py-2">Chargement…</p>
            ) : filteredParticipants.length === 0 ? (
              <p className="text-[11px] text-gray-500 px-1 py-2">
                {searchTrimmed
                  ? 'Aucun participant ne correspond à votre recherche.'
                  : 'Aucun spectateur connecté pour l\u2019instant.'}
              </p>
            ) : (
              filteredParticipants.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-[#1e1e2f] bg-[#0f0f16] px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {p.isDev ? <UserDevBadge className="shrink-0" /> : null}
                    {p.isVip ? (
                      <span
                        className="shrink-0 text-[9px] font-bold text-amber-400"
                        title="Modérateur"
                      >
                        ⭐
                      </span>
                    ) : null}
                    <UsernameDisplay
                      username={p.username}
                      usernameColor={p.usernameColor}
                      className="text-xs text-gray-200 truncate flex-1 min-w-0"
                    />
                    {coHostId === p.id ? (
                      <button
                        type="button"
                        onClick={onCancelDuoInvite}
                        className="shrink-0 min-h-9 px-2 py-1 rounded-md text-[9px] font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                      >
                        Duo actif
                      </button>
                    ) : coHostInviteTargetId === p.id ? (
                      <button
                        type="button"
                        onClick={onCancelDuoInvite}
                        className="shrink-0 min-h-9 px-2 py-1 rounded-md text-[9px] font-bold bg-amber-950/40 border border-amber-500/30 text-amber-300 touch-manipulation"
                      >
                        Invité… ×
                      </button>
                    ) : canInviteDuo && !coHostId && onInviteDuo ? (
                      <button
                        type="button"
                        onClick={() => onInviteDuo(p.id)}
                        className="shrink-0 min-h-9 px-2 py-1 rounded-md text-[9px] font-bold bg-purple-950/40 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 transition touch-manipulation"
                      >
                        + Duo
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
      </div>
    ) : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-11 h-11 flex items-center justify-center rounded-lg transition text-sm leading-none touch-manipulation ${
          open
            ? 'text-purple-300 bg-purple-900/40'
            : 'text-gray-500 hover:text-white hover:bg-white/10'
        }`}
        aria-label="Participants"
        aria-expanded={open}
        title="Participants"
      >
        <span aria-hidden>👥</span>
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
