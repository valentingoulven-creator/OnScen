import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LiveChatConfig } from '../types';

export type LiveChatConfigValue = LiveChatConfig;

const CHAT_DELAY_PRESETS = [0, 5, 10, 15, 30, 60] as const;
const MAX_BLOCKED_TERMS = 50;

type LiveChatConfigFieldsProps = {
  value: LiveChatConfigValue;
  onChange: (patch: Partial<LiveChatConfigValue>) => void;
};

export function LiveChatConfigFields({ value, onChange }: LiveChatConfigFieldsProps) {
  const { t } = useTranslation();
  const slowSeconds = value.slowModeSeconds ?? 0;
  const blockedTerms = value.blockedTerms ?? [];
  const [termInput, setTermInput] = useState('');

  const setDelay = (seconds: number) => {
    onChange({ slowModeSeconds: Math.max(0, Math.min(120, seconds)) });
  };

  const addBlockedTerm = () => {
    const term = termInput.trim().toLowerCase();
    if (!term || blockedTerms.length >= MAX_BLOCKED_TERMS || blockedTerms.includes(term)) {
      setTermInput('');
      return;
    }
    onChange({ blockedTerms: [...blockedTerms, term] });
    setTermInput('');
  };

  const removeBlockedTerm = (term: string) => {
    onChange({ blockedTerms: blockedTerms.filter((t2) => t2 !== term) });
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">{t('live.chatDelayTitle')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {t('live.chatDelayHint')}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CHAT_DELAY_PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setDelay(sec)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition touch-manipulation ${
                slowSeconds === sec
                  ? 'border-purple-500/50 bg-purple-900/40 text-purple-200'
                  : 'border-[#232330] text-gray-400 hover:text-white hover:border-[#3a3a4a]'
              }`}
            >
              {sec === 0 ? t('live.chatDelayOff') : t('live.chatDelaySeconds', { count: sec })}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="live-chat-delay-custom" className="text-[11px] text-gray-500 shrink-0">
            {t('live.chatDelayCustom')}
          </label>
          <input
            id="live-chat-delay-custom"
            type="number"
            min={0}
            max={120}
            step={1}
            value={slowSeconds}
            onChange={(e) => setDelay(Number(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 min-h-11 rounded-lg bg-[#0b0b0f] border border-[#2a2a3a] text-white text-sm text-center focus:border-purple-500/60 focus:outline-none touch-manipulation"
          />
          <span className="text-[11px] text-gray-500">{t('live.chatDelayUnit')}</span>
        </div>

        {slowSeconds > 0 && (
          <p className="text-[11px] text-purple-400">
            {t('live.chatDelayActive', { seconds: slowSeconds })}
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{t('live.chatNoLinksTitle')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {t('live.chatNoLinksHint')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!value.noLinksForParticipants}
          onClick={() =>
            onChange({ noLinksForParticipants: !value.noLinksForParticipants })
          }
          className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
            value.noLinksForParticipants
              ? 'bg-purple-600 border-purple-500'
              : 'bg-[#1e1e2f] border-[#2a2a3a]'
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
              value.noLinksForParticipants ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{t('live.chatSubsOnlyTitle')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {t('live.chatSubsOnlyHint')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!value.subscribersOnly}
          onClick={() => onChange({ subscribersOnly: !value.subscribersOnly })}
          className={`shrink-0 w-11 h-6 rounded-full border transition-colors ${
            value.subscribersOnly
              ? 'bg-purple-600 border-purple-500'
              : 'bg-[#1e1e2f] border-[#2a2a3a]'
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
              value.subscribersOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>

      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2.5">
        <div>
          <p className="text-sm font-semibold text-white">{t('live.chatBlockedTermsTitle')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {t('live.chatBlockedTermsHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={termInput}
            maxLength={64}
            onChange={(e) => setTermInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addBlockedTerm();
              }
            }}
            disabled={blockedTerms.length >= MAX_BLOCKED_TERMS}
            className="flex-1 min-w-0 px-2.5 py-2 min-h-11 rounded-lg bg-[#0b0b0f] border border-[#2a2a3a] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation disabled:opacity-50"
            placeholder={t('live.chatBlockedTermsPlaceholder')}
          />
          <button
            type="button"
            onClick={addBlockedTerm}
            disabled={!termInput.trim() || blockedTerms.length >= MAX_BLOCKED_TERMS}
            className="shrink-0 min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition touch-manipulation"
          >
            {t('live.chatBlockedTermsAdd')}
          </button>
        </div>
        {blockedTerms.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {blockedTerms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-red-950/30 border border-red-500/25 text-red-300 text-[11px]"
              >
                {term}
                <button
                  type="button"
                  onClick={() => removeBlockedTerm(term)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/20 transition touch-manipulation"
                  aria-label={t('live.chatBlockedTermsRemove', { term })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-[10px] text-gray-600">
          {t('live.chatBlockedTermsCount', { count: blockedTerms.length, max: MAX_BLOCKED_TERMS })}
        </p>
      </div>
    </div>
  );
}
