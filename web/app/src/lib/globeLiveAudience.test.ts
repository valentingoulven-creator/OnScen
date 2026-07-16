import { describe, it, expect } from 'vitest';
import {
  computeNationalLiveAudienceAverages,
  filterGlobeLiveMarkersAboveAverageAudience,
  getLiveAudienceCount,
  getLiveSalonAudienceCount,
} from './globeLiveAudience';
import type { Live, Salon } from '../types';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const BRUSSELS = { latitude: 50.8503, longitude: 4.3517 };

const live = (id: string, viewers: number, coords = PARIS, countryCode?: string): Live =>
  ({
    id,
    hostId: id,
    viewersCount: viewers,
    countryCode,
    ...coords,
  }) as Live;

const salon = (id: string, listeners: number, coords = PARIS): Salon =>
  ({
    id,
    hostId: id,
    isLive: true,
    listenersCount: listeners,
    ...coords,
  }) as Salon;

describe('globeLiveAudience', () => {
  it('computes national averages independently per country', () => {
    const avgs = computeNationalLiveAudienceAverages(
      [live('fr-low', 10), live('fr-high', 30, PARIS), live('be', 100, BRUSSELS, 'BE')],
      []
    );
    expect(avgs.get('FR')).toBe(20);
    expect(avgs.get('BE')).toBe(100);
  });

  it('keeps markers at or above their national average', () => {
    const result = filterGlobeLiveMarkersAboveAverageAudience(
      [live('fr-low', 10), live('fr-high', 50), live('be-low', 5, BRUSSELS, 'BE'), live('be-high', 40, BRUSSELS, 'BE')],
      [salon('fr-mid', 20)]
    );
    expect(result.nationalAverages.get('FR')).toBe(80 / 3);
    expect(result.nationalAverages.get('BE')).toBe(22.5);
    expect(result.lives.map((l) => l.id)).toEqual(['fr-high', 'be-high']);
    expect(result.liveSalons).toHaveLength(0);
  });

  it('keeps markers exactly at the national average', () => {
    const result = filterGlobeLiveMarkersAboveAverageAudience(
      [live('fr-a', 20), live('fr-b', 20)],
      []
    );
    expect(result.lives.map((l) => l.id)).toEqual(['fr-a', 'fr-b']);
  });

  it('falls back to all lives when country cannot be resolved', () => {
    const ocean = { latitude: 0, longitude: 0 };
    const result = filterGlobeLiveMarkersAboveAverageAudience(
      [live('ocean-a', 500, ocean), live('ocean-b', 800, ocean)],
      []
    );
    expect(result.lives.map((l) => l.id)).toEqual(['ocean-a', 'ocean-b']);
  });

  it('resolves salon country from coordinates when countryCode absent', () => {
    const result = filterGlobeLiveMarkersAboveAverageAudience(
      [],
      [salon('s-low', 5), salon('s-high', 50)]
    );
    expect(result.nationalAverages.get('FR')).toBe(27.5);
    expect(result.liveSalons.map((s) => s.id)).toEqual(['s-high']);
  });

  it('excludes markers without a resolved country unless all would be removed', () => {
    const ocean = { latitude: 0, longitude: 0 };
    const result = filterGlobeLiveMarkersAboveAverageAudience(
      [live('ocean', 999, ocean), live('fr', 50)],
      []
    );
    expect(result.lives.map((l) => l.id)).toEqual(['fr']);
  });

  it('ignores non-live salons', () => {
    const offAir = { id: 'off', isLive: false, listenersCount: 999, ...PARIS } as Salon;
    expect(getLiveSalonAudienceCount(offAir)).toBe(0);
    const result = filterGlobeLiveMarkersAboveAverageAudience([live('a', 20)], [offAir]);
    expect(result.liveSalons).toHaveLength(0);
    expect(result.lives.map((l) => l.id)).toEqual(['a']);
  });

  it('handles missing counts as zero', () => {
    expect(getLiveAudienceCount({ id: 'x' } as Live)).toBe(0);
  });
});
