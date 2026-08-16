import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getProfilePath } from '../lib/profileDeepLink';
import type { SupportContactMessage, SupportThreadMessage } from '../types';

function formatDateTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getThread(msg: SupportContactMessage): SupportThreadMessage[] {
  if (msg.thread && msg.thread.length > 0) return msg.thread;
  const thread: SupportThreadMessage[] = [
    {
      id: `${msg.id}_u0`,
      role: 'user',
      body: msg.body,
      createdAt: msg.createdAt,
      authorUserId: msg.fromUserId,
    },
  ];
  if (msg.adminReply && msg.repliedAt) {
    thread.push({
      id: `${msg.id}_a0`,
      role: 'admin',
      body: msg.adminReply,
      createdAt: msg.repliedAt,
      authorUserId: 'admin',
    });
  }
  if (msg.userReply && msg.userRepliedAt) {
    thread.push({
      id: `${msg.id}_u1`,
      role: 'user',
      body: msg.userReply,
      createdAt: msg.userRepliedAt,
      authorUserId: msg.fromUserId,
    });
  }
  return thread;
}

function statusLabelKey(status: SupportContactMessage['status']): string {
  if (status === 'open') return 'admin.support.statusOpen';
  if (status === 'replied') return 'admin.support.statusReplied';
  return 'admin.support.statusResolved';
}

function statusBadgeClass(status: SupportContactMessage['status']): string {
  if (status === 'open') return 'bg-amber-500/20 text-amber-300';
  if (status === 'replied') return 'bg-green-500/20 text-green-300';
  return 'bg-gray-500/20 text-gray-300';
}

interface AdminSupportTicketDossierProps {
  ticket: SupportContactMessage;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  replying: boolean;
  resolving: boolean;
  reopening: boolean;
  onClose: () => void;
  onReply: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onCopy: (text: string, label: string) => void;
}

export function AdminSupportTicketDossier({
  ticket,
  replyDraft,
  onReplyDraftChange,
  replying,
  resolving,
  reopening,
  onClose,
  onReply,
  onResolve,
  onReopen,
  onCopy,
}: AdminSupportTicketDossierProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const canReply = ticket.status !== 'resolved';
  const canResolve = ticket.status !== 'resolved';
  const busy = replying || resolving || reopening;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.thread?.length, ticket.adminReply, ticket.userReply]);

  const panel = (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-support-ticket-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg lg:max-w-2xl max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-[#0b0b0f] border border-[#1e1e2f] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[#1e1e2f] px-4 py-3 flex gap-3 items-start">
          <div className="shrink-0 w-12 h-12 rounded-full bg-[#1a1a26] border border-[#2d2d3d] overflow-hidden flex items-center justify-center text-lg">
            {ticket.fromAvatarUrl ? (
              <img src={ticket.fromAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>👤</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/90">
              {t('admin.support.ticketKicker')}
            </p>
            <h2 id="admin-support-ticket-title" className="text-base font-bold truncate">
              @{ticket.fromUsername}
            </h2>
            <p className="text-xs text-gray-500 truncate">{ticket.fromEmail ?? ticket.fromUserId}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClass(ticket.status)}`}>
                {t(statusLabelKey(ticket.status))}
              </span>
              {ticket.accountStatus === 'blocked' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                  {t('admin.accounts.statusBlocked')}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#14141c] border border-[#2a2a3a] text-gray-300 hover:text-white"
            aria-label={t('admin.support.closeTicket')}
          >
            ×
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          <section className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-purple-300/90">
              {t('admin.support.sectionUser')}
            </h3>
            {ticket.fromCity ? (
              <p className="text-xs text-gray-400">
                {t('admin.support.fieldCity')} {ticket.fromCity}
              </p>
            ) : null}
            <p className="text-[10px] text-gray-600 font-mono break-all">{ticket.id}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                onClick={() => window.open(getProfilePath(ticket.fromUserId), '_blank', 'noopener,noreferrer')}
              >
                {t('admin.support.openProfile')}
              </button>
              {ticket.fromEmail ? (
                <button
                  type="button"
                  className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                  onClick={() => onCopy(ticket.fromEmail!, t('admin.accounts.copiedEmail'))}
                >
                  {t('admin.accounts.copyEmail')}
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-purple-300/90">
              {t('admin.support.sectionThread')}
            </h3>
            <p className="text-[10px] text-gray-500">
              {t('admin.support.openedAt', { date: formatDateTime(ticket.createdAt, locale) })}
            </p>
            {getThread(ticket).map((entry) => {
              const isAdmin = entry.role === 'admin';
              return (
                <div
                  key={entry.id}
                  className={`flex items-end gap-1.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        isAdmin
                          ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm'
                          : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-sm'
                      }`}
                    >
                      {entry.body}
                    </div>
                    <p className={`text-[9px] text-gray-500 mt-1 px-1 ${isAdmin ? 'text-right' : 'text-left'}`}>
                      {formatTime(entry.createdAt, locale)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </section>
        </div>

        <footer className="shrink-0 border-t border-[#1e1e2f] px-4 py-3 space-y-2 bg-[#0f0f16] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {ticket.status === 'resolved' ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-gray-400">{t('admin.support.ticketResolved')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={onReopen}
                className="w-full min-h-11 rounded-xl bg-purple-600/80 text-white font-bold text-sm disabled:opacity-50"
              >
                {reopening ? t('app.loading') : t('admin.support.reopen')}
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={replyDraft}
                onChange={(e) => onReplyDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onReply();
                  }
                }}
                rows={3}
                maxLength={4000}
                placeholder={t('admin.support.replyInputPlaceholder')}
                className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-2xl px-3 py-2.5 text-white text-sm resize-none focus:border-purple-500/60 outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {canReply ? (
                  <button
                    type="button"
                    onClick={onReply}
                    disabled={busy || replyDraft.trim().length < 1}
                    className="flex-1 min-h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm disabled:opacity-50"
                  >
                    {replying ? t('admin.support.replying') : t('admin.support.sendReply')}
                  </button>
                ) : null}
                {canResolve ? (
                  <button
                    type="button"
                    onClick={onResolve}
                    disabled={busy}
                    className="min-h-11 px-4 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm disabled:opacity-50"
                  >
                    {resolving ? t('admin.support.markingResolved') : t('admin.support.markResolved')}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
}
