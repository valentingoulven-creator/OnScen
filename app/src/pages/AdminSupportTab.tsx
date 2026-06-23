import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSupportTicketRoom, useSupportTicketUpdates } from '../hooks/useSupportTicketRealtime';
import type { SupportContactMessage, SupportContactStatus, SupportThreadMessage } from '../types';
import { AdminReportsTab } from './AdminReportsTab';
import { AdminSupportLogsPanel } from './AdminSupportLogsPanel';

export type SupportSubTab = 'messages' | 'reports' | 'logs';

type StatusFilter = 'all' | SupportContactStatus;

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

function statusLabelKey(status: SupportContactStatus): string {
  if (status === 'open') return 'admin.support.statusOpen';
  if (status === 'replied') return 'admin.support.statusReplied';
  return 'admin.support.statusResolved';
}

function statusBadgeClass(status: SupportContactStatus): string {
  if (status === 'open') return 'bg-amber-500/20 text-amber-300';
  if (status === 'replied') return 'bg-green-500/20 text-green-300';
  return 'bg-gray-500/20 text-gray-300';
}

function upsertMessage(
  messages: SupportContactMessage[],
  updated: SupportContactMessage
): SupportContactMessage[] {
  const idx = messages.findIndex((m) => m.id === updated.id);
  if (idx === -1) return [updated, ...messages];
  const next = [...messages];
  next[idx] = updated;
  return next;
}

function SupportSubTabBar({
  subTab,
  onChange,
  t,
}: {
  subTab: SupportSubTab;
  onChange: (tab: SupportSubTab) => void;
  t: (key: string) => string;
}) {
  const items: { id: SupportSubTab; label: string }[] = [
    { id: 'messages', label: t('admin.support.subTabMessages') },
    { id: 'reports', label: t('admin.support.subTabReports') },
    { id: 'logs', label: t('admin.support.subTabLogs') },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 border-b border-[#1e1e2f]"
      aria-label={t('admin.support.subTabsAria')}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
            subTab === item.id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

interface AdminSupportTabProps {
  highlightMessageId?: string;
  initialSubTab?: SupportSubTab;
}

function AdminSupportMessagesPanel({ highlightMessageId }: { highlightMessageId?: string }) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<StatusFilter>(highlightMessageId ? 'all' : 'open');
  const [messages, setMessages] = useState<SupportContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminSupportMessages(token, { status: filter });
      setMessages(res.messages);
      if (highlightMessageId) {
        setSelectedId(highlightMessageId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, filter, highlightMessageId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRealtimeUpdate = useCallback(
    (updated: SupportContactMessage) => {
      setMessages((prev) => {
        if (filter !== 'all' && updated.status !== filter) {
          return prev.filter((m) => m.id !== updated.id);
        }
        return upsertMessage(prev, updated);
      });
    },
    [filter]
  );

  useSupportTicketUpdates(handleRealtimeUpdate, Boolean(token));
  useSupportTicketRoom(selectedId, Boolean(token && selectedId));

  useEffect(() => {
    if (highlightMessageId) {
      setSelectedId(highlightMessageId);
    }
  }, [highlightMessageId]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const canReply = selected && selected.status === 'open';
  const canResolve = selected && selected.status === 'replied';
  const isResolved = selected?.status === 'resolved';

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId, selected?.thread?.length, selected?.adminReply, selected?.userReply]);

  const sendReply = async () => {
    if (!token || !selected || !canReply) return;
    const reply = replyDraft.trim();
    if (!reply) return;
    setReplying(true);
    setError(null);
    try {
      const res = await api.replyAdminSupportMessage(token, selected.id, reply);
      setReplyDraft('');
      setMessages((prev) => upsertMessage(prev, res.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.replyError'));
    } finally {
      setReplying(false);
    }
  };

  const markResolved = async () => {
    if (!token || !selected || !canResolve) return;
    setResolving(true);
    setError(null);
    try {
      const res = await api.resolveAdminSupportMessage(token, selected.id);
      setMessages((prev) => upsertMessage(prev, res.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.resolveError'));
    } finally {
      setResolving(false);
    }
  };

  const filters: StatusFilter[] = ['open', 'replied', 'resolved', 'all'];

  const toggleTicket = (msgId: string) => {
    setSelectedId((prev) => (prev === msgId ? null : msgId));
    setReplyDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {t(`admin.support.filter.${f}`)}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">{t('admin.support.loading')}</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-500">{t('admin.support.empty')}</p>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => {
            const isExpanded = selectedId === msg.id;
            return (
              <div key={msg.id} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleTicket(msg.id)}
                  className={`w-full text-left border p-3 transition ${
                    isExpanded
                      ? 'rounded-t-xl border-purple-500/60 bg-purple-950/20 border-b-0'
                      : msg.id === highlightMessageId
                        ? 'rounded-xl border-amber-500/50 bg-amber-950/10'
                        : 'rounded-xl border-[#2d2d3d] bg-[#12121a] hover:border-[#3d3d4d]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{msg.fromUsername}</p>
                      <p className="text-[10px] text-gray-500">
                        {formatDateTime(msg.createdAt, i18n.language)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(msg.status)}`}
                    >
                      {t(statusLabelKey(msg.status))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2 line-clamp-2 whitespace-pre-wrap">{msg.body}</p>
                  {msg.userReply && msg.status === 'open' && (
                    <p className="text-[10px] text-amber-300/80 mt-1">{t('admin.support.userFollowUp')}</p>
                  )}
                </button>

                {isExpanded && selected && (
                  <div className="rounded-b-xl border border-t-0 border-purple-500/60 bg-[#12121a] flex flex-col max-h-[min(70vh,32rem)] overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
                      <div className="space-y-3">
                        {getThread(selected).map((entry) => {
                          const isAdmin = entry.role === 'admin';
                          return (
                            <div
                              key={entry.id}
                              className={`flex items-end gap-1.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}
                              >
                                <div
                                  className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                    isAdmin
                                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm shadow-sm shadow-purple-900/30'
                                      : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-sm'
                                  }`}
                                >
                                  {entry.body}
                                </div>
                                <p
                                  className={`text-[9px] text-gray-500 mt-1 px-1 ${isAdmin ? 'text-right' : 'text-left'}`}
                                >
                                  {formatTime(entry.createdAt, i18n.language)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={threadEndRef} />
                      </div>
                    </div>

                    <div className="shrink-0 border-t border-[#2d2d3d] px-3 py-3 space-y-2 bg-[#0f0f16]/80">
                      {isResolved ? (
                        <p className="text-xs text-center text-gray-400 py-1">
                          {t('admin.support.ticketResolved')}
                        </p>
                      ) : canResolve ? (
                        <>
                          <p className="text-[10px] text-center text-gray-500">
                            {t('admin.support.awaitingUser')}
                          </p>
                          <button
                            type="button"
                            onClick={() => void markResolved()}
                            disabled={resolving}
                            className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm disabled:opacity-50"
                          >
                            {resolving ? t('admin.support.markingResolved') : t('admin.support.markResolved')}
                          </button>
                        </>
                      ) : canReply ? (
                        <div className="flex items-end gap-2">
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void sendReply();
                              }
                            }}
                            rows={2}
                            maxLength={4000}
                            placeholder={t('admin.support.replyInputPlaceholder')}
                            className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-2xl px-3 py-2 text-white text-sm resize-none focus:border-purple-500/60 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void sendReply()}
                            disabled={replying || replyDraft.trim().length < 1}
                            className="shrink-0 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm disabled:opacity-50"
                          >
                            {replying ? t('admin.support.replying') : t('admin.support.sendReply')}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-center text-gray-400 py-1">
                          {t('admin.support.awaitingUser')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminSupportTab({ highlightMessageId, initialSubTab = 'messages' }: AdminSupportTabProps) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SupportSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4">
      <SupportSubTabBar subTab={subTab} onChange={setSubTab} t={t} />
      {subTab === 'messages' && <AdminSupportMessagesPanel highlightMessageId={highlightMessageId} />}
      {subTab === 'reports' && <AdminReportsTab />}
      {subTab === 'logs' && <AdminSupportLogsPanel />}
    </div>
  );
}
