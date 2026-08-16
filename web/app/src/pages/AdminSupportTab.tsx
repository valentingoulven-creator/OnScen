import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSupportTicketRoom, useSupportTicketUpdates } from '../hooks/useSupportTicketRealtime';
import { AdminSupportTicketDossier } from '../components/AdminSupportTicketDossier';
import type { AdminSupportCounts, SupportContactMessage, SupportContactStatus } from '../types';
import { AdminReportsTab } from './AdminReportsTab';
import { AdminDiagnosticsPanel } from './AdminDiagnosticsPanel';

export type SupportSubTab = 'messages' | 'reports' | 'diagnostic' | 'logs';

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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
    { id: 'diagnostic', label: t('admin.support.subTabDiagnostic') },
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
          className={`min-h-11 px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
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
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';
  const [filter, setFilter] = useState<StatusFilter>(highlightMessageId ? 'all' : 'open');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [messages, setMessages] = useState<SupportContactMessage[]>([]);
  const [counts, setCounts] = useState<AdminSupportCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminSupportMessages(token, {
        status: filter,
        q: debouncedSearch || undefined,
      });
      setMessages(res.messages);
      if (res.counts) setCounts(res.counts);
      if (highlightMessageId) setSelectedId(highlightMessageId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, filter, debouncedSearch, highlightMessageId, t]);

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
    if (highlightMessageId) setSelectedId(highlightMessageId);
  }, [highlightMessageId]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const sendReply = async () => {
    if (!token || !selected || selected.status === 'resolved') return;
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
    if (!token || !selected || selected.status === 'resolved') return;
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

  const reopen = async () => {
    if (!token || !selected || selected.status !== 'resolved') return;
    setReopening(true);
    setError(null);
    try {
      const res = await api.reopenAdminSupportMessage(token, selected.id);
      setMessages((prev) => upsertMessage(prev, res.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.reopenError'));
    } finally {
      setReopening(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    setFeedback(ok ? label : t('admin.accounts.copyFailed'));
    window.setTimeout(() => setFeedback(null), 2000);
  };

  const filters: StatusFilter[] = ['open', 'replied', 'resolved', 'all'];

  return (
    <div className="space-y-4">
      {counts ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { key: 'total', value: counts.total, color: 'text-white' },
              { key: 'open', value: counts.open, color: 'text-amber-300' },
              { key: 'replied', value: counts.replied, color: 'text-green-400' },
              { key: 'resolved', value: counts.resolved, color: 'text-gray-400' },
            ] as const
          ).map((stat) => (
            <div key={stat.key} className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                {t(`admin.support.stats.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          type="search"
          autoComplete="off"
          className="w-full bg-[#1a1a26] border border-purple-500/40 rounded-2xl pl-4 pr-10 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-purple-400"
          placeholder={t('admin.support.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.support.searchPlaceholder')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {t(`admin.support.filter.${f}`)}
          </button>
        ))}
        {feedback ? <span className="self-center text-xs text-purple-400">{feedback}</span> : null}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">{t('admin.support.loading')}</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-500">{t('admin.support.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((msg) => (
            <li key={msg.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(msg.id);
                  setReplyDraft('');
                }}
                className={`w-full text-left rounded-2xl border p-3 transition ${
                  msg.id === highlightMessageId
                    ? 'border-amber-500/50 bg-amber-950/10'
                    : 'border-[#2d2d3d] bg-[#12121a] hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">@{msg.fromUsername}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {msg.fromEmail ?? msg.fromUserId} · {formatDateTime(msg.createdAt, locale)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(msg.status)}`}
                  >
                    {t(statusLabelKey(msg.status))}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-2 line-clamp-2 whitespace-pre-wrap">{msg.body}</p>
                {msg.userReply && msg.status === 'open' ? (
                  <p className="text-[10px] text-amber-300/80 mt-1">{t('admin.support.userFollowUp')}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <AdminSupportTicketDossier
          ticket={selected}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
          replying={replying}
          resolving={resolving}
          reopening={reopening}
          onClose={() => setSelectedId(null)}
          onReply={() => void sendReply()}
          onResolve={() => void markResolved()}
          onReopen={() => void reopen()}
          onCopy={(text, label) => void handleCopy(text, label)}
        />
      ) : null}
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
      <p className="text-xs text-gray-500 leading-relaxed">{t('admin.support.pageLead')}</p>
      <SupportSubTabBar subTab={subTab} onChange={setSubTab} t={t} />
      {subTab === 'messages' && <AdminSupportMessagesPanel highlightMessageId={highlightMessageId} />}
      {subTab === 'reports' && <AdminReportsTab />}
      {(subTab === 'diagnostic' || subTab === 'logs') && <AdminDiagnosticsPanel />}
    </div>
  );
}
