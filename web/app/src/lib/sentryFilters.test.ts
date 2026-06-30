import { describe, expect, it } from 'vitest';
import { shouldIgnoreSentryEvent } from './sentryFilters';

describe('sentryFilters', () => {
  it('ignore les erreurs bruit navigateur', () => {
    expect(shouldIgnoreSentryEvent('ResizeObserver loop limit exceeded')).toBe(true);
    expect(shouldIgnoreSentryEvent('Loading chunk 42 failed')).toBe(true);
  });

  it('laisse passer les vraies erreurs', () => {
    expect(shouldIgnoreSentryEvent('Cannot read properties of undefined')).toBe(false);
  });
});
