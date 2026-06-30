const MAX_ENTRIES = 64;

const cache = new Map<string, unknown>();

export function readSearchSessionCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeSearchSessionCache<T>(key: string, value: T): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export function buildSearchCacheKey(namespace: string, query: string): string {
  return `${namespace}:${query.trim().toLowerCase()}`;
}
