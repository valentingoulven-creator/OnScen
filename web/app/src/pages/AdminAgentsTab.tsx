import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { AiAgentDefinition, AiChatMessage, AiAgentsStatus, AiTeamRecommendation } from '../types';

const STORAGE_PREFIX = 'onscen-admin-agent-chat:';

function loadStoredMessages(agentId: string): AiChatMessage[] {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${agentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeMessages(agentId: string, messages: AiChatMessage[]): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${agentId}`, JSON.stringify(messages));
  } catch {
    /* quota exceeded — ignore */
  }
}

function AgentPicker({
  agents,
  selected,
  onSelect,
}: {
  agents: AiAgentDefinition[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
      {agents.map((agent) => {
        const active = selected === agent.id;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelect(agent.id)}
            className={`shrink-0 flex items-center gap-2 px-3 py-2 min-h-11 rounded-xl text-xs font-semibold border transition ${
              active
                ? 'border-purple-500 bg-purple-950/40 text-white'
                : 'border-[#2d2d3d] bg-[#12121a] text-gray-400 hover:text-white'
            }`}
          >
            <span aria-hidden>{agent.emoji}</span>
            <span>{agent.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function MessageBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(100%,20rem)] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-purple-600 text-white rounded-br-md'
            : 'bg-[#1a1a26] text-gray-100 border border-[#2d2d3d] rounded-bl-md'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function formatCostEur(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

function formatTokens(n: number, locale: string): string {
  return n.toLocaleString(locale);
}

function UsageBadge({
  label,
  costEur,
  tokens,
  locale,
}: {
  label: string;
  costEur: number;
  tokens?: number;
  locale: string;
}) {
  return (
    <p className="text-[10px] text-gray-500">
      {label}: <span className="text-purple-300/90">{formatCostEur(costEur, locale)}</span>
      {tokens != null && (
        <span className="text-gray-600"> · {formatTokens(tokens, locale)} tokens</span>
      )}
    </p>
  );
}

function priorityClass(p: AiTeamRecommendation['priority']): string {
  switch (p) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-amber-400';
    case 'medium':
      return 'text-yellow-500/90';
    default:
      return 'text-gray-500';
  }
}

function AiTeamRecCard({ rec, t }: { rec: AiTeamRecommendation; t: (k: string) => string }) {
  return (
    <details className="rounded-lg border border-[#2d2d3d] bg-[#0b0b0f] p-2 group">
      <summary className="cursor-pointer list-none flex items-start gap-2 min-h-11 py-1">
        <span className="text-base shrink-0" aria-hidden>
          {rec.suggestedEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">
            {rec.name}{' '}
            <span className={priorityClass(rec.priority)}>
              · {rec.urgencyScore}/100 · {rec.priority}
            </span>
          </p>
          <p className="text-[10px] text-gray-500 truncate">{rec.headline}</p>
        </div>
      </summary>
      <div className="mt-2 space-y-2 pl-1 border-t border-[#2d2d3d] pt-2">
        <div>
          <p className="text-[10px] font-semibold text-purple-300/90">{t('admin.agents.aiTeamWhyNow')}</p>
          <ul className="mt-1 space-y-1">
            {rec.whyNow.slice(0, 4).map((line) => (
              <li key={line.slice(0, 40)} className="text-[10px] text-gray-400">
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-purple-300/90">{t('admin.agents.aiTeamCostOfWaiting')}</p>
          <ul className="mt-1 space-y-1">
            {rec.costOfWaiting.slice(0, 2).map((line) => (
              <li key={line.slice(0, 40)} className="text-[10px] text-gray-400">
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] text-gray-600">
          {t('admin.agents.aiTeamApiCost')}: {rec.estimatedApiCostEurMonth}
        </p>
      </div>
    </details>
  );
}

export function AdminAgentsTab() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [status, setStatus] = useState<AiAgentsStatus | null>(null);
  const [agentId, setAgentId] = useState<string>('ceo');
  const [messages, setMessages] = useState<AiChatMessage[]>(() => loadStoredMessages('ceo'));
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionCostEur, setSessionCostEur] = useState(0);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [lastMessageCost, setLastMessageCost] = useState<{ costEur: number; tokens: number } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent = status?.agents.find((a) => a.id === agentId);
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const monthUsage = status?.usage;
  const isAnthropic = status?.provider === 'anthropic';

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getAiAgentsStatus(token)
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.agents.loadError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    setMessages(loadStoredMessages(agentId));
    setDraft('');
    setError(null);
    setSessionCostEur(0);
    setSessionTokens(0);
    setLastMessageCost(null);
  }, [agentId]);

  useEffect(() => {
    storeMessages(agentId, messages);
  }, [agentId, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const switchAgent = (id: string) => {
    setAgentId(id);
  };

  const clearChat = () => {
    setMessages([]);
    storeMessages(agentId, []);
  };

  const sendMessage = useCallback(async () => {
    if (!token || !draft.trim() || sending) return;
    if (!status?.configured) {
      setError(t('admin.agents.notConfigured'));
      return;
    }

    const userMessage: AiChatMessage = { role: 'user', content: draft.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);
    setError(null);

    try {
      const res = await api.sendAiAgentChat(token, agentId as 'ceo' | 'dev', nextMessages);
      setMessages((prev) => [...prev, res.message]);
      if (res.cost) {
        const tokens = res.cost.inputTokens + res.cost.outputTokens;
        setLastMessageCost({ costEur: res.cost.costEur, tokens });
        setSessionCostEur((prev) => prev + res.cost!.costEur);
        setSessionTokens((prev) => prev + tokens);
      }
      if (res.monthUsage) {
        setStatus((prev) => (prev ? { ...prev, usage: res.monthUsage } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.agents.sendError'));
      setMessages(messages);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [token, draft, sending, messages, agentId, status, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{t('admin.agents.loading')}</p>;
  }

  return (
    <div className="flex flex-col min-h-[min(70dvh,32rem)] gap-3">
      {status && (
        <AgentPicker agents={status.agents} selected={agentId} onSelect={switchAgent} />
      )}

      {selectedAgent && (
        <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-3">
          <p className="text-sm font-semibold text-white">
            {selectedAgent.emoji} {selectedAgent.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{selectedAgent.description}</p>
          {agentId === 'ceo' && status?.configured && (
            <p className="text-[10px] text-gray-600 mt-2">{t('admin.agents.ceoAiTeamHint')}</p>
          )}
          {agentId === 'ceo' && status?.ceo?.aiTeam && status.ceo.aiTeam.recommendations.length > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-200">{t('admin.agents.aiTeamRecTitle')}</p>
              <p className="text-[10px] text-gray-500">{status.ceo.aiTeam.summaryForFounder}</p>
              <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain">
                {status.ceo.aiTeam.recommendations
                  .filter((r) => r.priority !== 'not_now')
                  .slice(0, 4)
                  .map((rec) => (
                    <AiTeamRecCard key={rec.agentId} rec={rec} t={t} />
                  ))}
              </div>
            </div>
          )}
          {agentId === 'ceo' && status?.ceo && status.ceo.dataGaps.length > 0 && (
            <div className="mt-3 rounded-lg border border-purple-500/25 bg-purple-950/15 p-3 space-y-2">
              <p className="text-xs font-semibold text-purple-200">
                {t('admin.agents.ceoDataGapsTitle', { count: status.ceo.dataGaps.length })}
              </p>
              <p className="text-[10px] text-gray-500">{t('admin.agents.ceoDataGapsHint')}</p>
              <ul className="space-y-2 max-h-40 overflow-y-auto overscroll-contain">
                {status.ceo.dataGaps.slice(0, 6).map((gap) => (
                  <li key={gap.id} className="text-xs text-gray-300">
                    <span
                      className={
                        gap.severity === 'critical'
                          ? 'text-red-400'
                          : gap.severity === 'high'
                            ? 'text-amber-400'
                            : 'text-gray-500'
                      }
                    >
                      [{gap.severity}]
                    </span>{' '}
                    {gap.question}
                  </li>
                ))}
              </ul>
              {!status.ceo.founderContextLoaded && (
                <p className="text-[10px] text-purple-300/90">{t('admin.agents.ceoFounderContextFile')}</p>
              )}
            </div>
          )}
          {status && !status.configured && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
              <p className="text-xs text-amber-300 font-semibold">{t('admin.agents.notConfigured')}</p>
              <ol className="text-xs text-amber-200/90 space-y-1 list-decimal list-inside">
                <li>{t('admin.agents.setupStep1')}</li>
                <li>{t('admin.agents.setupStep2')}</li>
                <li>{t('admin.agents.setupStep3')}</li>
              </ol>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-purple-300 underline"
              >
                {t('admin.agents.getAnthropicKey')}
              </a>
            </div>
          )}
          {status?.configured && status.model && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-gray-600">
                {status.provider} · {status.model}
              </p>
              {isAnthropic && monthUsage && monthUsage.requestCount > 0 && (
                <UsageBadge
                  label={t('admin.agents.monthCostAnthropic', { month: monthUsage.month })}
                  costEur={monthUsage.costEur}
                  tokens={monthUsage.inputTokens + monthUsage.outputTokens}
                  locale={locale}
                />
              )}
              {isAnthropic && monthUsage && monthUsage.requestCount > 0 && (
                <p className="text-[10px] text-gray-600">
                  {t('admin.agents.monthCostUsd', {
                    usd: monthUsage.costUsd.toFixed(4),
                    count: monthUsage.requestCount,
                  })}
                  {' · '}
                  <a
                    href="https://console.anthropic.com/settings/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/80 underline"
                  >
                    {t('admin.agents.billingConsole')}
                  </a>
                </p>
              )}
              {sessionCostEur > 0 && (
                <UsageBadge
                  label={t('admin.agents.sessionCost')}
                  costEur={sessionCostEur}
                  tokens={sessionTokens}
                  locale={locale}
                />
              )}
              {lastMessageCost && (
                <UsageBadge
                  label={t('admin.agents.lastMessageCost')}
                  costEur={lastMessageCost.costEur}
                  tokens={lastMessageCost.tokens}
                  locale={locale}
                />
              )}
              {isAnthropic && (
                <p className="text-[10px] text-gray-700">{t('admin.agents.costEstimateHint')}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-[12rem] max-h-[50dvh] overflow-y-auto overscroll-contain space-y-3 rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] p-3"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-gray-500">{t('admin.agents.empty')}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {(agentId === 'ceo'
                ? [
                    t('admin.agents.suggestCeoTangYuBrief'),
                    t('admin.agents.suggestCeoAiTeam'),
                    t('admin.agents.suggestCeoBrief'),
                    t('admin.agents.suggestCeoPriorities'),
                  ]
                : [
                    t('admin.agents.suggestDevSprint'),
                    t('admin.agents.suggestDevInnovation'),
                    t('admin.agents.suggestDevCrit01'),
                    t('admin.agents.suggestDevScale'),
                    t('admin.agents.suggestDevApple'),
                  ]
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="text-xs px-3 py-2 min-h-11 rounded-full bg-[#1a1a26] text-purple-300 border border-purple-500/30 hover:bg-purple-950/30"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={`${msg.role}-${i}`} message={msg} />)
        )}
        {sending && (
          <p className="text-xs text-gray-500 animate-pulse">{t('admin.agents.thinking')}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={t('admin.agents.inputPlaceholder')}
          disabled={sending || !status?.configured}
          className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-[#2d2d3d] bg-[#12121a] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || !draft.trim() || !status?.configured}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-40"
          aria-label={t('admin.agents.send')}
        >
          ↑
        </button>
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          onClick={clearChat}
          className="self-start text-xs text-gray-500 hover:text-gray-300"
        >
          {t('admin.agents.clearChat')}
        </button>
      )}
    </div>
  );
}
