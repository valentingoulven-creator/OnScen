import { useEffect, useId, useRef, useState } from 'react';
import { searchAddressSuggestions, type AddressSuggestion } from '../lib/geocodeAddress';

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  listMaxHeightClass?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Rue, code postal, ville…',
  className = '',
  inputClassName = 'w-full px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-xs text-white placeholder:text-gray-500',
  listMaxHeightClass = 'max-h-40',
}: AddressAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
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
      searchAddressSuggestions(q)
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

  const pick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    onSelect(suggestion);
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
        maxLength={200}
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
          className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[#2a2a3f] bg-[#12121a] shadow-lg overflow-hidden"
        >
          <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
            Propositions
          </p>
          {loading && suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-[10px] text-gray-500">Recherche…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-[10px] text-gray-500">Aucune adresse trouvée</p>
          ) : (
            <ul className={`${listMaxHeightClass} overflow-y-auto`}>
              {suggestions.map((s) => (
                <li key={`${s.latitude}-${s.longitude}-${s.label}`}>
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className="w-full text-left px-2 py-1.5 text-[10px] text-gray-200 hover:bg-[#1a1a26] active:bg-[#252535] line-clamp-2"
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
