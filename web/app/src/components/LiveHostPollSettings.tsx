import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivePoll } from '../types';

type LiveHostPollSettingsProps = {
  activePoll?: LivePoll;
  onCreate: (question: string, options: string[]) => void;
  onClose: () => void;
};

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;

/** Config live : créer un sondage / Q&A, suivre les résultats en direct, le clôturer. */
export function LiveHostPollSettings({ activePoll, onCreate, onClose }: LiveHostPollSettingsProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const updateOption = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  const addOption = () => setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
  const removeOption = (i: number) =>
    setOptions((prev) => (prev.length > MIN_OPTIONS ? prev.filter((_, idx) => idx !== i) : prev));

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && cleanOptions.length >= MIN_OPTIONS;

  const create = () => {
    if (!canCreate) return;
    onCreate(question.trim(), cleanOptions);
    setQuestion('');
    setOptions(['', '']);
  };

  if (activePoll) {
    const total = activePoll.totalVotes;
    return (
      <div className="flex flex-col gap-3 pt-2">
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3">
          <p className="text-sm font-bold text-white mb-2">{activePoll.question}</p>
          <div className="flex flex-col gap-2">
            {activePoll.options.map((o) => {
              const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
              return (
                <div key={o.id} className="rounded-lg overflow-hidden bg-[#12121a] border border-[#2a2a3a]">
                  <div className="relative px-2.5 py-2">
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-600/25"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-xs text-white truncate">{o.label}</span>
                      <span className="text-[10px] font-bold text-purple-300 tabular-nums shrink-0">
                        {pct}% ({o.count})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            {t('live.pollTotalVotes', { count: total })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-11 py-2 rounded-xl bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs font-bold transition touch-manipulation"
        >
          {t('live.pollCloseBtn')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <p className="text-[11px] text-gray-500 leading-relaxed px-0.5">{t('live.pollHint')}</p>
      <input
        type="text"
        value={question}
        maxLength={140}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t('live.pollQuestionPlaceholder')}
        className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation"
      />
      <div className="flex flex-col gap-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={o}
              maxLength={60}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={t('live.pollOptionPlaceholder', { index: i + 1 })}
              className="flex-1 px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation"
            />
            {options.length > MIN_OPTIONS ? (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 transition touch-manipulation"
                aria-label={t('live.pollRemoveOption')}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {options.length < MAX_OPTIONS ? (
        <button
          type="button"
          onClick={addOption}
          className="w-full min-h-9 py-1.5 rounded-lg border border-dashed border-[#2a2a3a] text-gray-500 text-[11px] hover:border-purple-500/40 hover:text-purple-300 transition touch-manipulation"
        >
          + {t('live.pollAddOption')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={create}
        disabled={!canCreate}
        className="w-full min-h-11 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition touch-manipulation"
      >
        {t('live.pollCreateBtn')}
      </button>
    </div>
  );
}
