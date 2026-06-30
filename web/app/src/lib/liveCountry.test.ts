import { describe, expect, it } from 'vitest';
import {
  collectLiveCountryOptions,
  filterLivesByCountry,
  FRANCE_COUNTRY_CODE,
  hasLivesOutsideFrance,
  LIVES_COUNTRY_FILTER_ALL,
} from './liveCountry';
import type { Live } from '../types';

function live(code: string, name: string): Live {
  return {
    id: `live_${code}`,
    hostId: 'host',
    hostName: 'Host',
    title: 'Test',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 't',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      progressMs: 0,
      updatedAt: 0,
    },
    latitude: 0,
    longitude: 0,
    viewersCount: 1,
    isActive: true,
    countryCode: code,
    countryName: name,
  };
}

describe('liveCountry (client)', () => {
  it('détecte des lives hors France', () => {
    const lives = [live(FRANCE_COUNTRY_CODE, 'France'), live('BE', 'Belgique')];
    expect(hasLivesOutsideFrance(lives)).toBe(true);
    expect(hasLivesOutsideFrance([live(FRANCE_COUNTRY_CODE, 'France')])).toBe(false);
  });

  it('filtre par pays', () => {
    const lives = [live(FRANCE_COUNTRY_CODE, 'France'), live('BE', 'Belgique')];
    expect(filterLivesByCountry(lives, 'BE')).toHaveLength(1);
    expect(filterLivesByCountry(lives, LIVES_COUNTRY_FILTER_ALL)).toHaveLength(2);
  });

  it('collecte les options pays', () => {
    const options = collectLiveCountryOptions([
      live('CH', 'Suisse'),
      live(FRANCE_COUNTRY_CODE, 'France'),
      live('BE', 'Belgique'),
    ]);
    expect(options.map((o) => o.code)).toEqual(['FR', 'BE', 'CH']);
  });
});
