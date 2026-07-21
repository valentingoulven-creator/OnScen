import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedReelsFeed,
  invalidateReelsFeedCache,
  setCachedReelsFeed,
} from './reelFeedCache';

describe('reelFeedCache', () => {
  afterEach(() => {
    invalidateReelsFeedCache();
    vi.useRealTimers();
  });

  it('renvoie undefined tant que rien n’a été mis en cache', () => {
    expect(getCachedReelsFeed('viewer-1:built-in')).toBeUndefined();
  });

  it('renvoie la valeur mise en cache tant que le TTL n’a pas expiré', () => {
    setCachedReelsFeed('viewer-1:built-in', ['a', 'b']);
    expect(getCachedReelsFeed<string[]>('viewer-1:built-in')).toEqual(['a', 'b']);
  });

  it('expire après le TTL fourni', () => {
    vi.useFakeTimers();
    setCachedReelsFeed('viewer-1:built-in', ['a']);
    vi.advanceTimersByTime(5_000);
    expect(getCachedReelsFeed<string[]>('viewer-1:built-in', 5_000)).toBeUndefined();
  });

  it('ne mélange pas les clés (viewer/algo différents = entrées distinctes)', () => {
    setCachedReelsFeed('viewer-1:built-in', ['a']);
    setCachedReelsFeed('viewer-2:built-in', ['b']);
    expect(getCachedReelsFeed<string[]>('viewer-1:built-in')).toEqual(['a']);
    expect(getCachedReelsFeed<string[]>('viewer-2:built-in')).toEqual(['b']);
  });

  it('invalidateReelsFeedCache() vide tout le cache', () => {
    setCachedReelsFeed('viewer-1:built-in', ['a']);
    setCachedReelsFeed('viewer-2:built-in', ['b']);
    invalidateReelsFeedCache();
    expect(getCachedReelsFeed('viewer-1:built-in')).toBeUndefined();
    expect(getCachedReelsFeed('viewer-2:built-in')).toBeUndefined();
  });
});
