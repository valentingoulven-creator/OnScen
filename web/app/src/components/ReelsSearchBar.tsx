import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReelsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ReelsSearchBar({ value, onChange, className }: ReelsSearchBarProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(() => value.trim().length > 0);

  const collapse = useCallback(() => {
    if (value.trim()) return;
    setExpanded(false);
  }, [value]);

  const expand = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (value.trim()) setExpanded(true);
  }, [value]);

  useEffect(() => {
    if (!expanded) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapse, expanded]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (value) {
        onChange('');
        inputRef.current?.focus();
      } else {
        collapse();
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div
      className={`ms-reels-search pointer-events-auto${expanded ? ' ms-reels-search--open' : ''}${className ? ` ${className}` : ''}`}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchCancel={(e) => e.stopPropagation()}
    >
      <div ref={rootRef} className="ms-reels-search__inner">
        {!expanded ? (
          <button
            type="button"
            onClick={expand}
            aria-label={t('reels.searchLabel')}
            className="ms-reels-search__toggle"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        ) : (
          <div className="ms-reels-search__field">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-300/70" aria-hidden>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('reels.searchPlaceholder')}
              autoComplete="off"
              aria-label={t('reels.searchLabel')}
              className="ms-reels-search__input"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  inputRef.current?.focus();
                }}
                className="ms-reels-search__clear"
                aria-label={t('reels.searchClear')}
              >
                ×
              </button>
            ) : (
              <button
                type="button"
                onClick={collapse}
                className="ms-reels-search__clear"
                aria-label={t('map.globeSearchClose', 'Fermer')}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
