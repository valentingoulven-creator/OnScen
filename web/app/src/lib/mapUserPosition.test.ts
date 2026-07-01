import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveMapCameraFallbackCenter, resolveProfileCityCoordsSync } from './mapUserPosition';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe('resolveProfileCityCoordsSync', () => {
  it('resolves Le Crès from profile city label', () => {
    const coords = resolveProfileCityCoordsSync('Le Crès');
    expect(coords).not.toBeNull();
    expect(coords![0]).toBeCloseTo(43.6489, 2);
    expect(coords![1]).toBeCloseTo(3.9394, 2);
  });

  it('resolves preset city Montpellier', () => {
    const coords = resolveProfileCityCoordsSync('Montpellier');
    expect(coords).not.toBeNull();
    expect(coords![0]).toBeCloseTo(43.6108, 2);
  });

  it('returns null for empty city', () => {
    expect(resolveProfileCityCoordsSync('')).toBeNull();
    expect(resolveProfileCityCoordsSync(undefined)).toBeNull();
  });
});

describe('resolveMapCameraFallbackCenter', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses profile city when geo source is my_position', () => {
    const coords = resolveMapCameraFallbackCenter('Montpellier');
    expect(coords[0]).toBeCloseTo(43.6108, 2);
    expect(coords[1]).toBeCloseTo(3.8767, 2);
  });

  it('falls back to Paris when no profile city', () => {
    const coords = resolveMapCameraFallbackCenter(undefined);
    expect(coords[0]).toBeCloseTo(48.8566, 2);
    expect(coords[1]).toBeCloseTo(2.3522, 2);
  });
});
