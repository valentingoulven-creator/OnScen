import { describe, expect, it } from 'vitest';
import { maskProfanity } from './chatTextFilter';

describe('maskProfanity', () => {
  it('masks common French insults', () => {
    expect(maskProfanity('putain de merde')).toMatch(/\*+/);
    expect(maskProfanity('putain de merde')).not.toContain('putain');
  });

  it('leaves clean text unchanged', () => {
    expect(maskProfanity('Hello Soundy')).toBe('Hello Soundy');
  });
});
