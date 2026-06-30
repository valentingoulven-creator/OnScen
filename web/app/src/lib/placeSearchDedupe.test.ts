import { describe, expect, it } from 'vitest';
import {
  cityPlaceDedupeKey,
  dedupePlaceHits,
  normalizeCityLabelForDedupe,
} from './placeSearchDedupe';

type CityHit = {
  kind: 'city';
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
};

const lyon69000: CityHit = {  kind: 'city',
  label: 'Lyon (69000)',
  latitude: 45.75,
  longitude: 4.85,
  postalCode: '69000',
};

const lyon69001: CityHit = {
  kind: 'city',
  label: 'Lyon (69001)',
  latitude: 45.76,
  longitude: 4.84,
  postalCode: '69001',
};

const lyonPlain: CityHit = {
  kind: 'city',
  label: 'Lyon',
  latitude: 45.75,
  longitude: 4.85,
};

describe('normalizeCityLabelForDedupe', () => {
  it('strip postal code and country suffix', () => {
    expect(normalizeCityLabelForDedupe('Lyon (69001)')).toBe('lyon');
    expect(normalizeCityLabelForDedupe('Paris, France')).toBe('paris');
  });
});

describe('cityPlaceDedupeKey', () => {
  it('merges same city name when not searching by postcode', () => {
    expect(cityPlaceDedupeKey(lyon69000, false)).toBe('lyon');
    expect(cityPlaceDedupeKey(lyon69001, false)).toBe('lyon');
    expect(cityPlaceDedupeKey(lyonPlain, false)).toBe('lyon');
  });

  it('keeps distinct keys per postal code on postcode search', () => {
    expect(cityPlaceDedupeKey(lyon69000, true)).toBe('lyon|69000');
    expect(cityPlaceDedupeKey(lyon69001, true)).toBe('lyon|69001');
  });
});

describe('dedupePlaceHits', () => {
  it('collapses Lyon variants to one result for name search', () => {
    const out = dedupePlaceHits([lyon69000, lyon69001, lyonPlain], 'lyon');
    expect(out).toHaveLength(1);
    expect(out[0]?.label).toBe('Lyon (69000)');
  });

  it('keeps multiple postcodes when query is a postcode', () => {
    const out = dedupePlaceHits([lyon69000, lyon69001], '6900');
    expect(out).toHaveLength(2);
  });
});
