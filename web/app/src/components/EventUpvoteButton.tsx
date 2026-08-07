import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { formatEventUpvoteCount } from '../lib/formatCount';

interface EventUpvoteButtonProps {
  postId: string;
  upvoteCount: number;
  upvotedByMe: boolean;
  token: string | null;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (patch: { upvoteCount: number; upvotedByMe: boolean }) => void;
}

export function EventUpvoteButton({
  postId,
  upvoteCount,
  upvotedByMe,
  token,
  disabled,
  compact,
  onChange,
}: EventUpvoteButtonProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!token || disabled || busy) return;

    const wasUpvoted = upvotedByMe;
    const optimistic = {
      upvotedByMe: !wasUpvoted,
      upvoteCount: wasUpvoted ? Math.max(0, upvoteCount - 1) : upvoteCount + 1,
    };
    onChange?.(optimistic);
    setBusy(true);
    try {
      const r = wasUpvoted
        ? await api.unupvoteFeedEvent(token, postId)
        : await api.upvoteFeedEvent(token, postId);
      onChange?.({ upvoteCount: r.upvoteCount, upvotedByMe: r.upvoted });
    } catch {
      onChange?.({ upvoteCount, upvotedByMe: wasUpvoted });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={!token || disabled || busy}
      onClick={(e) => void toggle(e)}
      className={`shrink-0 flex flex-col items-center justify-center rounded-lg border transition disabled:opacity-50 ${
        compact ? 'min-w-[2.25rem] min-h-[44px] px-1 py-0.5' : 'min-w-[2.75rem] min-h-[44px] px-1.5 py-1'
      } ${
        upvotedByMe
          ? 'border-amber-400/55 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          : 'border-white/15 bg-black/45 text-gray-200 hover:border-amber-400/40 hover:text-amber-200 hover:bg-amber-500/10 backdrop-blur-sm'
      }`}
      aria-pressed={upvotedByMe}
      aria-label={upvotedByMe ? t('feed.eventUpvoteRemove') : t('feed.eventUpvote')}
      title={upvotedByMe ? t('feed.eventUpvoteRemove') : t('feed.eventUpvote')}
    >
      <span className={`leading-none ${compact ? 'text-[9px]' : 'text-[10px]'}`} aria-hidden>
        ▲
      </span>
      <span className={`font-bold leading-tight tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {formatEventUpvoteCount(upvoteCount)}
      </span>
    </button>
  );
}
