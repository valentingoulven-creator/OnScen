import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { SupportContactMessage, SupportContactStatus, SupportThreadMessage } from '../types';

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

interface AdminSupportTabProps {
  highlightMessageId?: string;
}

export function AdminSupportTab({ highlightMessageId }: AdminSupportTabProps) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<StatusFilter>(highlightMessageId ? 'all' : 'open');
  const [messages, setMessages] = useState<SupportContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);

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

  useEffect(() => {
    if (highlightMessageId) {
      setSelectedId(highlightMessageId);
    }
  }, [highlightMessageId]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const canReply = selected && selected.status === 'open';

  const sendReply = async () => {
    if (!token || !selected || !canReply) return;
    const reply = replyDraft.trim();
    if (!reply) return;
    setReplying(true);
    setError(null);
    try {
      await api.replyAdminSupportMessage(token, selected.id, reply);
      setReplyDraft('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.replyError'));
    } finally {
      setReplying(false);
    }
  };

  const filters: StatusFilter[] = ['open', 'replied', 'resolved', 'all'];

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
          {messages.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => {
                setSelectedId(msg.id);
                setReplyDraft('');
              }}
              className={`w-full text-left rounded-xl border p-3 transition ${
                selectedId === msg.id
                  ? 'border-purple-500/60 bg-purple-950/20'
                  : msg.id === highlightMessageId
                    ? 'border-amber-500/50 bg-amber-950/10'
                    : 'border-[#2d2d3d] bg-[#12121a] hover:border-[#3d3d4d]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{msg.fromUsername}</p>
                  <p className="text-[10px] text-gray-500">{formatDateTime(msg.createdAt, i18n.language)}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(msg.status)}`}
                >
                  {t(statusLabelKey(msg.status))}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-2 line-clamp-2 whitespace-pre-wrap">{msg.body}</p>
              {msg.userReply && (
                <p className="text-[10px] text-amber-300/80 mt-1">{t('admin.support.userFollowUp')}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">{t('admin.support.from')}</p>
            <p className="text-sm font-semibold">{selected.fromUsername}</p>
            <p className="text-[10px] text-gray-500">{formatDateTime(selected.createdAt, i18n.language)}</p>
          </div>

          <div className="space-y-3">
            {getThread(selected).map((entry) => (
              <div
                key={entry.id}
                className={entry.role === 'admin' ? 'pt-2 border-t border-[#2d2d3d]' : undefined}
              >
                <p className="text-xs font-semibold text-purple-300">
                  {entry.role === 'admin' ? t('admin.support.yourReply') : t('admin.support.userMessage')}
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatDateTime(entry.createdAt, i18n.language)}
                </p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{entry.body}</p>
              </div>
            ))}
          </div>

          {canReply ? (
            <>
              <label className="block">
                <span className="text-xs text-gray-400">{t('admin.support.replyPlaceholder')}</span>
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={replying || replyDraft.trim().length < 1}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm disabled:opacity-50"
              >
                {replying ? t('admin.support.replying') : t('admin.support.sendReply')}
              </button>
            </>
          ) : selected.status === 'resolved' ? (
            <p className="text-xs text-gray-400">{t('admin.support.ticketResolved')}</p>
          ) : (
            <p className="text-xs text-gray-400">{t('admin.support.awaitingUser')}</p>
          )}
        </div>
      )}
    </div>
  );
}
