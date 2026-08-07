import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../lib/socket';
import type { LivePoll } from '../types';

type LivePollWidgetProps = {
  liveId: string;
  poll: LivePoll;
  isHost: boolean;
};

/** Sondage / Q&A live affiché en tête du chat (spectateurs votent, hôte suit les résultats). */
export function LivePollWidget({ liveId, poll, isHost }: LivePollWidgetProps) {
  const { t } = useTranslation();
  const [localVote, setLocalVote] = useState<string | undefined>(poll.myVote);

  useEffect(() => {
    setLocalVote(poll.myVote);
  }, [poll.id, poll.myVote]);

  const myVote = localVote ?? poll.myVote;
  const closed = !!poll.closedAt;
  const showResults = isHost || closed || !!myVote;

  const vote = (optionId: string) => {
    if (isHost || closed) return;
    setLocalVote(optionId);
    getSocket()?.emit('live_poll_vote', { liveId, optionId });
  };

  return (
    <div className="shrink-0 px-3 py-2.5 border-b border-purple-500/20 bg-purple-950/15">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-purple-400 text-xs shrink-0" aria-hidden>
          🗳
        </span>
        <p className="text-[9px] font-bold text-purple-300 uppercase tracking-widest">
          {t('live.pollBadge')}
        </p>
      </div>
      <p className="text-xs font-semibold text-white mb-2 leading-snug">{poll.question}</p>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const pct = poll.totalVotes > 0 ? Math.round((o.count / poll.totalVotes) * 100) : 0;
          const selected = myVote === o.id;
          if (!showResults) {
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => vote(o.id)}
                className="min-h-10 px-3 py-2 rounded-lg text-left text-xs font-medium text-white bg-[#1a1a26] border border-[#2a2a3a] hover:border-purple-500/50 hover:bg-purple-950/30 transition touch-manipulation"
              >
                {o.label}
              </button>
            );
          }
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              disabled={isHost || closed}
              className={`relative overflow-hidden rounded-lg border text-left touch-manipulation ${
                selected ? 'border-purple-500/60 bg-purple-950/40' : 'border-[#2a2a3a] bg-[#1a1a26]'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-purple-600/20"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                <span className={`text-xs truncate ${selected ? 'text-purple-200 font-bold' : 'text-white'}`}>
                  {selected ? '✓ ' : ''}
                  {o.label}
                </span>
                <span className="text-[10px] font-bold text-purple-300 tabular-nums shrink-0">
                  {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">
        {closed
          ? t('live.pollClosedLabel')
          : t('live.pollTotalVotes', { count: poll.totalVotes })}
      </p>
    </div>
  );
}
