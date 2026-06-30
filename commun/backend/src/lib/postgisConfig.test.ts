import { describe, it, expect } from 'vitest';
import { kmToMeters } from './postgisConfig';

describe('postgisConfig', () => {
  it('convertit km en mètres', () => {
    expect(kmToMeters(10)).toBe(10_000);
    expect(kmToMeters(0)).toBe(0);
    expect(kmToMeters(-5)).toBe(0);
  });
});
