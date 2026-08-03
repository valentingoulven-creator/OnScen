import { describe, expect, it } from 'vitest';
import {
  areMapSponsorAdListsEqual,
  buildMapSponsorViewportFetchKey,
} from './sponsorMapViewport';

describe('sponsorMapViewport', () => {
  it('buildMapSponsorViewportFetchKey ignores sub‑km jitter', () => {
    const a = buildMapSponsorViewportFetchKey({ lat: 48.8512, lng: 2.3522, zoom: 12.4 });
    const b = buildMapSponsorViewportFetchKey({ lat: 48.8519, lng: 2.3528, zoom: 12.6 });
    expect(a).toBe(b);
  });

  it('buildMapSponsorViewportFetchKey changes when zoom tier changes', () => {
    const a = buildMapSponsorViewportFetchKey({ lat: 48.85, lng: 2.35, zoom: 8.2 });
    const b = buildMapSponsorViewportFetchKey({ lat: 48.85, lng: 2.35, zoom: 9.1 });
    expect(a).not.toBe(b);
  });

  it('areMapSponsorAdListsEqual compares ids in order', () => {
    expect(
      areMapSponsorAdListsEqual(
        [{ id: 'a' }, { id: 'b' }],
        [{ id: 'a' }, { id: 'b' }]
      )
    ).toBe(true);
    expect(
      areMapSponsorAdListsEqual([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])
    ).toBe(false);
  });
});
