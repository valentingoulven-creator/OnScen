import { useEffect, useRef, useState } from 'react';
import {
  buildSearchCacheKey,
  readSearchSessionCache,
  writeSearchSessionCache,
} from '../lib/searchSessionCache';

interface UseDebouncedApiSearchOptions<T> {
  query: string;
  fetcher: (trimmedQuery: string, signal: AbortSignal) => Promise<T[]>;
  minLength?: number;
  debounceMs?: number;
  cacheNamespace?: string;
  enabled?: boolean;
}

export function useDebouncedApiSearch<T>({
  query,
  fetcher,
  minLength = 2,
  debounceMs = 350,
  cacheNamespace,
  enabled = true,
}: UseDebouncedApiSearchOptions<T>) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestGenRef = useRef(0);

  useEffect(() => {
    let controller: AbortController | null = null;
    const trimmed = query.trim();

    if (!enabled || trimmed.length < minLength) {
      requestGenRef.current += 1;
      setResults([]);
      setLoading(false);
      setIsPending(false);
      setError(null);
      return;
    }

    setIsPending(true);
    setError(null);

    const timer = window.setTimeout(() => {
      setIsPending(false);
      const cacheKey = cacheNamespace ? buildSearchCacheKey(cacheNamespace, trimmed) : null;
      if (cacheKey) {
        const cached = readSearchSessionCache<T[]>(cacheKey);
        if (cached) {
          setResults(cached);
          setLoading(false);
          return;
        }
      }

      const gen = ++requestGenRef.current;
      controller = new AbortController();
      setLoading(true);

      fetcherRef
        .current(trimmed, controller.signal)
        .then((items) => {
          if (gen !== requestGenRef.current) return;
          setResults(items);
          if (cacheKey) writeSearchSessionCache(cacheKey, items);
        })
        .catch((e: unknown) => {
          if (gen !== requestGenRef.current) return;
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setResults([]);
          setError(e instanceof Error ? e.message : 'Search failed');
        })
        .finally(() => {
          if (gen === requestGenRef.current) setLoading(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [query, enabled, minLength, debounceMs, cacheNamespace]);

  const busy = isPending || loading;

  return { results, loading: busy, isPending, fetching: loading, error, setError, setResults };
}
