import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSupportTicketUpdates } from '../hooks/useSupportTicketRealtime';
import type { SupportContactMessage, SupportThreadMessage } from '../types';

interface ContactSoundyPageProps {
  onBack: () => void;
  highlightMessageId?: string;
  /** Renders content only (no header/scroll shell) for embedding in SettingsPage. */
  embedded?: boolean;
}

function formatDateTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

export function ContactSoundyPage({ onBack, highlightMessageId, embedded }: ContactSoundyPageProps) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<SupportContactMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await api.getMySupportMessages(token);
      setHistory(res.messages);
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRealtimeUpdate = useCallback(
    (updated: SupportContactMessage) => {
      setHistory((prev) => {
        const idx = prev.findIndex((m) => m.id === updated.id);
        if (idx === -1) {
          if (updated.status === 'resolved') return prev;
          return [updated, ...prev];
        }
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      if (updated.status === 'resolved') {
        showToast(t('support.resolvedByAdmin'));
      }
    },
    [showToast, t]
  );

  useSupportTicketUpdates(handleRealtimeUpdate, Boolean(token));

  useEffect(() => {
    if (!highlightMessageId || loadingHistory) return;
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId, loadingHistory, history.length]);

  const submit = async () => {
    if (!token) return;
    const text = body.trim();
    if (text.length < 3) return;
    setSending(true);
    setError(null);
    try {
      await api.submitSupportContact(token, text);
      setBody('');
      showToast(t('support.sent'));
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('support.sendError'));
    } finally {
      setSending(false);
    }
  };

  const sendThreadReply = async (msg: SupportContactMessage) => {
    if (!token) return;
    const text = (replyDrafts[msg.id] ?? '').trim();
    if (text.length < 3) return;
    setReplyingId(msg.id);
    setError(null);
    try {
      await api.replySupportContact(token, msg.id, text);
      setReplyDrafts((prev) => ({ ...prev, [msg.id]: '' }));
      showToast(t('support.replySent'));
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('support.replyError'));
    } finally {
      setReplyingId(null);
    }
  };

  const markResolved = async (msg: SupportContactMessage) => {
    if (!token) return;
    setResolvingId(msg.id);
    setError(null);
    try {
      await api.resolveSupportContact(token, msg.id);
      showToast(t('support.resolved'));
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('support.resolveError'));
    } finally {
      setResolvingId(null);
    }
  };

  const content = (
    <div className={`${embedded ? '' : 'flex-1 '}p-4 max-w-lg mx-auto w-full space-y-4`}>
        <p className="text-sm text-gray-400">{t('support.intro')}</p>

        <label className="block">
          <span className="text-xs text-gray-400">{t('support.messageLabel')}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder={t('support.messagePlaceholder')}
            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || body.trim().length < 3}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
        >
          {sending ? t('support.sending') : t('support.send')}
        </button>

        {history.length > 0 && (
          <section className="pt-2 space-y-3">
            <h2 className="text-sm font-bold text-gray-300">{t('support.historyTitle')}</h2>
            {loadingHistory ? (
              <p className="text-xs text-gray-500">{t('support.loading')}</p>
            ) : (
              history.map((msg) => {
                const thread = getThread(msg);
                const isHighlighted = msg.id === highlightMessageId;
                const canReplyOrResolve = msg.status === 'replied';

                return (
                  <div
                    key={msg.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={`rounded-xl border p-3 space-y-2 ${
                      isHighlighted
                        ? 'border-purple-500/60 bg-purple-950/20'
                        : 'border-[#2d2d3d] bg-[#12121a]'
                    }`}
                  >
                    {msg.status === 'resolved' && (
                      <div className="rounded-lg bg-green-950/30 border border-green-500/30 px-3 py-2 space-y-1">
                        <p className="text-[10px] font-bold text-green-400/90">{t('support.statusResolved')}</p>
                        <p className="text-xs text-green-200/90">{t('support.resolvedByAdmin')}</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {thread.map((entry) => (
                        <div
                          key={entry.id}
                          className={
                            entry.role === 'admin' ? 'pt-2 border-t border-[#2d2d3d]' : undefined
                          }
                        >
                          <p className="text-xs font-semibold text-purple-300">
                            {entry.role === 'admin' ? t('support.replyLabel') : t('support.youLabel')}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatDateTime(entry.createdAt, i18n.language)}
                          </p>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{entry.body}</p>
                        </div>
                      ))}
                    </div>
                    {msg.status === 'open' && !msg.adminReply && (
                      <p className="text-[10px] text-amber-400/90">{t('support.pending')}</p>
                    )}
                    {msg.status === 'open' && msg.adminReply && (
                      <p className="text-[10px] text-amber-400/90">{t('support.awaitingAdmin')}</p>
                    )}
                    {canReplyOrResolve && (
                      <div className="pt-2 border-t border-[#2d2d3d] space-y-2">
                        <label className="block">
                          <span className="text-xs text-gray-400">{t('support.followUpLabel')}</span>
                          <textarea
                            value={replyDrafts[msg.id] ?? ''}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                            }
                            rows={3}
                            maxLength={4000}
                            placeholder={t('support.followUpPlaceholder')}
                            className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void sendThreadReply(msg)}
                            disabled={
                              replyingId === msg.id || (replyDrafts[msg.id] ?? '').trim().length < 3
                            }
                            className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm disabled:opacity-50"
                          >
                            {replyingId === msg.id ? t('support.replying') : t('support.reply')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void markResolved(msg)}
                            disabled={resolvingId === msg.id}
                            className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm disabled:opacity-50"
                          >
                            {resolvingId === msg.id ? t('support.resolving') : t('support.resolvedButton')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
  );

  const toastEl = toast && (
    <div className="fixed bottom-24 left-4 right-4 z-[80] mx-auto max-w-sm pointer-events-none">
      <div className="rounded-xl bg-green-900/90 border border-green-500/40 px-4 py-3 text-center text-sm text-green-100 shadow-xl">
        {toast}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <>
        {content}
        {toastEl}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f] text-white">
      <header className="shrink-0 z-10 bg-[#0b0b0f]/95 border-b border-[#1e1e2f] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button type="button" onClick={onBack} className="text-purple-400 text-sm shrink-0">
            ←
          </button>
          <h1 className="text-lg font-bold flex-1">{t('support.title')}</h1>
        </div>
      </header>
      {content}
      {toastEl}
    </div>
  );
}
