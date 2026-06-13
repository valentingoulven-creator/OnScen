import { describe, it, expect } from 'vitest';
import { liveStreamReadyForRelay } from './liveVideoRelay';

describe('liveStreamReadyForRelay', () => {
  it('returns false for null', () => {
    expect(liveStreamReadyForRelay(null)).toBe(false);
    expect(liveStreamReadyForRelay(undefined)).toBe(false);
  });
});
