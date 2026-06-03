import { useEffect, useId, useRef, useState } from 'react';
import { searchCities, type CitySuggestion } from '../lib/citySearch';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Ex: Paris',
  className = '',
  inputClassName = 'mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm',
}: CityAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchCities(q)
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const showDropdown =
    focused && value.trim().length >= MIN_CHARS && (loading || suggestions.length > 0);

  const pick = (suggestion: CitySuggestion) => {
    onChange(suggestion.value);
    setFocused(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={showDropdown ? listId : undefined}
        aria-expanded={showDropdown}
        className={inputClassName}
      />
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-lg overflow-hidden"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
            Suggestions
          </p>
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">Recherche…</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={`${s.label}-${s.value}`}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#1a1a26] active:bg-[#252535]"
                  >
                    {s.label}
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
