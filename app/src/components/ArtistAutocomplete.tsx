import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchArtists, type ArtistSuggestion } from '../lib/artistSearch';

const MIN_CHARS = 2;

interface ArtistAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: ArtistSuggestion) => void;
  exclude?: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  emptyHint?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function ArtistAutocomplete({
  value,
  onChange,
  onSelect,
  exclude = [],
  placeholder = 'Ex: Daft Punk',
  className = '',
  inputClassName = 'flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-white text-sm',
  emptyHint = 'Aucun artiste trouvé — validez votre saisie',
  onKeyDown,
}: ArtistAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(
    () => searchArtists(value, exclude),
    [value, exclude]
  );

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const showDropdown = focused && value.trim().length >= MIN_CHARS;

  const pick = (suggestion: ArtistSuggestion) => {
    onChange(suggestion.value);
    onSelect?.(suggestion);
    setFocused(false);
  };

  return (
    <div ref={rootRef} className={`relative flex-1 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setFocused(false);
            e.preventDefault();
            return;
          }
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={showDropdown ? listId : undefined}
        aria-expanded={showDropdown}
        className={`w-full ${inputClassName}`}
      />
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-lg overflow-hidden"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
            Suggestions
          </p>
          {suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">{emptyHint}</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className="w-full text-left px-4 py-2 hover:bg-[#1e1e2f] active:bg-[#252535] cursor-pointer"
                  >
                    <span className="block text-sm text-white">{s.label}</span>
                    {s.subtitle && <span className="block text-xs text-gray-500">{s.subtitle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
