import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ReelsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ReelsSearchBar({ value, onChange, className }: ReelsSearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`pointer-events-auto${className ? ` ${className}` : ''}`}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchCancel={(e) => e.stopPropagation()}
    >
      <div className="relative flex items-center h-9 rounded-full bg-black/55 border border-purple-500/25 shadow-lg shadow-black/30 backdrop-blur-md transition-[border-color,box-shadow] focus-within:border-purple-400/50 focus-within:ring-2 focus-within:ring-purple-500/20">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300/70 pointer-events-none" aria-hidden>
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
          placeholder={t('reels.searchPlaceholder')}
          autoComplete="off"
          aria-label={t('reels.searchLabel')}
          className="w-full h-full pl-9 pr-8 text-xs rounded-full bg-transparent text-white placeholder:text-gray-400/90 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 text-sm leading-none transition-colors"
            aria-label={t('reels.searchClear')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
