import { describe, expect, it } from 'vitest';
import { PROFILE_TYPE_OPTIONS, getProfileTypeLabel } from './profileTypes';

describe('profileTypes', () => {
  it('exposes unique values with French labels', () => {
    const values = PROFILE_TYPE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('bar');
    expect(values).toContain('dj');
    expect(values).toContain('autre');
  });

  it('resolves labels for known types', () => {
    expect(getProfileTypeLabel('restaurant')).toBe('Restaurant');
    expect(getProfileTypeLabel('salle_concert')).toBe('Salle de concert');
    expect(getProfileTypeLabel('unknown')).toBeUndefined();
    expect(getProfileTypeLabel(undefined)).toBeUndefined();
  });
});
