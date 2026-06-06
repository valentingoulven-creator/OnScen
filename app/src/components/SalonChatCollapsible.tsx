import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket, onSocketConnect } from '../lib/socket';
import { ChatPanel } from './ChatPanel';
import type { LiveBanScope } from './LiveUserBanModal';
import type { Salon } from '../types';

interface SalonChatCollapsibleProps {
  salonId: string;
  /** Replié par défaut (ex. profil carte à proximité). */
  defaultExpanded?: boolean;
  /** Mode contrôlé (fiche carte : boutons Chat / Afficher le chat). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Réinitialise l’état replié quand la valeur change (ex. ouverture profil carte). */
  collapseResetKey?: string | null;
  salonTitle?: string;
  className?: string;
  /** Style discret pour la fiche carte (petit salon). */
  variant?: 'default' | 'map';
}

export function SalonChatCollapsible({
  salonId,
  defaultExpanded = true,
  expanded: expandedControlled,
  onExpandedChange,
  collapseResetKey,
  salonTitle,
  className = '',
  variant = 'default',
}: SalonChatCollapsibleProps) {
  const isMap = variant === 'map';
  const { user, token } = useAuth();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [expandedInternal, setExpandedInternal] = useState(defaultExpanded);
  const controlled = expandedControlled !== undefined;
  const expanded = controlled ? expandedControlled : expandedInternal;

  const setExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(expanded) : next;
      if (!controlled) setExpandedInternal(value);
      onExpandedChange?.(value);
    },
    [controlled, expanded, onExpandedChange]
  );

  useEffect(() => {
    if (!controlled) setExpandedInternal(defaultExpanded);
  }, [defaultExpanded, collapseResetKey, salonId, controlled]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getSalon(token, salonId)
      .then((r) => {
        if (!cancelled) setSalon(r.salon);
      })
      .catch(() => {
        if (!cancelled) setSalon(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, salonId]);

  useEffect(() => {
    if (!token || !user || !salon) return;
    if (salon.canJoin === false && salon.hostId !== user.id) return;
    const socket = getSocket();
    const joinSalon = () => {
      socket.emit('join_salon', { salonId, userId: user.id, username: user.username });
    };
    joinSalon();
    const offReconnect = onSocketConnect(joinSalon);
    return () => {
      offReconnect();
      socket.emit('leave_salon', { salonId });
    };
  }, [salonId, salon?.canJoin, salon?.hostId, user?.id, user?.username, token]);

  const handleSetVip = useCallback(
    (targetUserId: string, add: boolean) => {
      getSocket().emit('salon_set_vip', { salonId, userId: targetUserId, add });
    },
    [salonId]
  );

  const handleBanUser = useCallback(
    (
      targetUserId: string,
      opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }
    ) => {
      getSocket().emit('salon_ban', {
        salonId,
        userId: targetUserId,
        permanent: opts.permanent,
        durationMs: opts.durationMs,
      });
    },
    [salonId]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      getSocket().emit('salon_chat_delete', { salonId, messageId });
    },
    [salonId]
  );

  const expandChat = useCallback(() => setExpanded(true), [setExpanded]);

  if (!token || !user) return null;

  const isHost = salon?.isHost ?? salon?.hostId === user.id;
  const canModerate = isHost || Boolean(salon?.isVip);
  const label = salonTitle ?? salon?.title ?? 'Salon';

  return (
    <section
      className={`shrink-0 border-t flex flex-col ${
        isMap ? 'border-white/10 bg-[#0e0e14]' : 'border-[#1e1e2f] bg-[#0b0b0f]'
      } ${className}`}
      aria-label={`Chat du salon ${label}`}
    >
      <div
        className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b ${
          isMap ? 'bg-[#131318]/60 border-white/10' : 'bg-[#12121a]/80 border-[#1e1e2f]'
        }`}
      >
        {expanded ? (
          <p
            className={`text-xs truncate min-w-0 ${
              isMap
                ? 'font-medium text-[#7878a0]'
                : 'font-bold text-purple-400 uppercase tracking-wider'
            }`}
          >
            {isMap ? `Chat · ${label}` : `Chat · ${label}`}
          </p>
        ) : (
          <span
            className={`text-[11px] truncate min-w-0 ${isMap ? 'text-[#6b6b8a]' : 'text-gray-500'}`}
          >
            Salon · {label}
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={
            isMap
              ? `flex items-center gap-1 shrink-0 rounded-full font-medium border border-white/10 bg-[#131318] transition px-2.5 py-1 text-[10px] text-[#8b8baf] hover:bg-white/5 hover:text-white`
              : `flex items-center gap-1.5 shrink-0 rounded-full font-bold border border-[#2d2d3d] bg-[#1a1a26] transition ${
                  expanded
                    ? 'px-2.5 py-1 text-[10px] text-gray-400 hover:text-purple-300 hover:border-purple-500/40'
                    : 'px-3 py-1.5 text-[11px] text-purple-300 hover:border-purple-500/40'
                }`
          }
          aria-expanded={expanded}
          aria-label={expanded ? 'Masquer le chat' : 'Afficher le chat'}
        >
          {!isMap && <span aria-hidden>💬</span>}
          <span>{expanded ? 'Masquer le chat' : 'Afficher le chat'}</span>
          <span className="text-[10px] opacity-60" aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      </div>
      {!expanded && (
        <div
          className={`shrink-0 p-3 flex gap-2 items-center ${
            isMap ? '' : 'border-t border-[#1e1e2f]'
          }`}
          role="group"
          aria-label="Message public — afficher le chat"
        >
          <input
            type="text"
            readOnly
            placeholder="Message public..."
            onClick={expandChat}
            onFocus={expandChat}
            className={
              isMap
                ? 'flex-1 min-w-0 bg-[#0e0e16] border border-[#1e1e2a] rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-600 cursor-pointer focus:outline-none focus:border-[#3a3a5a]'
                : 'flex-1 min-w-0 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-500 cursor-pointer focus:outline-none focus:border-purple-500/50'
            }
            aria-label="Message public — afficher le chat"
          />
          <button
            type="button"
            onClick={expandChat}
            className={
              isMap
                ? 'shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#42426a] text-white text-sm hover:bg-[#52527a] transition'
                : 'shrink-0 px-4 py-2 bg-purple-600 rounded-full text-white font-bold text-sm'
            }
            aria-label="Afficher le chat"
          >
            {isMap ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              '→'
            )}
          </button>
        </div>
      )}
      {expanded && (
        <div className="flex-1 min-h-[120px] max-h-[200px] flex flex-col min-w-0">
          {salon ? (
            <ChatPanel
              roomId={salonId}
              roomType="salon"
              userId={user.id}
              userName={user.username}
              token={token}
              isHost={isHost}
              canModerateChat={canModerate}
              hostId={salon.hostId}
              vipModeratorIds={salon.vipModeratorIds}
              onSetVip={isHost ? handleSetVip : undefined}
              onBanUser={canModerate ? handleBanUser : undefined}
              onDeleteMessage={canModerate ? handleDeleteMessage : undefined}
            />
          ) : (
            <p className="p-4 text-center text-xs text-gray-500">Chargement du chat…</p>
          )}
        </div>
      )}
    </section>
  );
}
