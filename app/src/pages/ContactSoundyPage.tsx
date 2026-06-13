import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { SupportContactMessage } from '../types';

interface ContactSoundyPageProps {
  onBack: () => void;
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

export function ContactSoundyPage({ onBack }: ContactSoundyPageProps) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<SupportContactMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
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
              history.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-3 space-y-2"
                >
                  <p className="text-xs text-gray-500">{formatDateTime(msg.createdAt, i18n.language)}</p>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.body}</p>
                  {msg.adminReply && (
                    <div className="mt-2 pt-2 border-t border-[#2d2d3d]">
                      <p className="text-xs font-semibold text-purple-300">{t('support.replyLabel')}</p>
                      {msg.repliedAt && (
                        <p className="text-[10px] text-gray-500">
                          {formatDateTime(msg.repliedAt, i18n.language)}
                        </p>
                      )}
                      <p className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{msg.adminReply}</p>
                    </div>
                  )}
                  {!msg.adminReply && msg.status === 'open' && (
                    <p className="text-[10px] text-amber-400/90">{t('support.pending')}</p>
                  )}
                </div>
              ))
            )}
          </section>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 z-[80] mx-auto max-w-sm pointer-events-none">
          <div className="rounded-xl bg-green-900/90 border border-green-500/40 px-4 py-3 text-center text-sm text-green-100 shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
