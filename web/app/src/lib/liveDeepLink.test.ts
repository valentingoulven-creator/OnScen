import { describe, expect, it } from 'vitest';
import {
  getLivePath,
  parseLiveIdFromLocation,
} from './liveDeepLink';

describe('liveDeepLink', () => {
  it('parseLiveIdFromLocation : /live/:id', () => {
    expect(
      parseLiveIdFromLocation({
        pathname: '/live/prod-seed-salon-beat-castel',
        search: '',
      } as Location)
    ).toBe('prod-seed-salon-beat-castel');
  });

  it('getLivePath encode le liveId', () => {
    expect(getLivePath('live/with/slash')).toBe('/live/live%2Fwith%2Fslash');
  });
});
