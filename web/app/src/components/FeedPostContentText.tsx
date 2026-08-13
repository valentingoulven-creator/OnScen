import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type FeedPostContentTextProps = {
  content: string;
  className?: string;
};

/** Texte publication fil — 1 ligne par défaut, « Plus » pour déplier (web + tel). */
export function FeedPostContentText({
  content,
  className = 'text-sm text-gray-200',
}: FeedPostContentTextProps) {
  const { t } = useTranslation();
  const trimmed = content.trim();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (expanded) return;
    const el = textRef.current;
    if (!el) return;

    const check = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [trimmed, expanded]);

  if (!trimmed) return null;

  const showToggle = truncated || expanded;

  return (
    <div className="min-w-0">
      <p
        ref={textRef}
        className={`${className} whitespace-pre-wrap break-words ${expanded ? '' : 'line-clamp-1'}`}
      >
        {trimmed}
      </p>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center min-h-11 py-1 text-xs font-semibold text-purple-300 hover:text-purple-200 active:text-purple-100 transition-colors"
        >
          {expanded
            ? t('feed.showLess', { defaultValue: 'Moins' })
            : t('feed.showMore', { defaultValue: 'Plus' })}
        </button>
      ) : null}
    </div>
  );
}
