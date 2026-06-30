import { describe, expect, it } from 'vitest';
import { PROFILE_TYPE_OPTIONS, getProfileTypeLabel, getProfileTypeOption } from './profileTypes';

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

  it('resolves full option with emoji', () => {
    expect(getProfileTypeOption('bar')).toEqual(
      expect.objectContaining({ value: 'bar', label: 'Bar', emoji: '🍸' })
    );
    expect(getProfileTypeOption('melomane')).toEqual(
      expect.objectContaining({ value: 'melomane', label: 'Mélomane', emoji: '🎵' })
    );
    expect(getProfileTypeOption(undefined)).toBeUndefined();
  });
});
