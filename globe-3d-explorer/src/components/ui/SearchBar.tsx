import { useMemo, useState, type FormEvent } from 'react';
import type { PreparedCountry } from '../../types';

interface SearchBarProps {
  countries: PreparedCountry[];
  onSelect: (country: PreparedCountry) => void;
}

const DATALIST_ID = 'country-search-options';

/** Recherche d'un pays avec autocomplétion (datalist native) et centrage caméra à la validation. */
export function SearchBar({ countries, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const names = useMemo(() => countries.map((c) => c.name), [countries]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) return;

    const exact = countries.find((c) => c.name.toLowerCase() === needle);
    const partial = exact ?? countries.find((c) => c.name.toLowerCase().startsWith(needle));
    if (partial) {
      onSelect(partial);
      setQuery(partial.name);
    }
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <input
        type="text"
        list={DATALIST_ID}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un pays…"
        aria-label="Rechercher un pays"
        disabled={countries.length === 0}
        autoComplete="off"
      />
      <datalist id={DATALIST_ID}>
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button type="submit" disabled={countries.length === 0}>
        Aller
      </button>
    </form>
  );
}
