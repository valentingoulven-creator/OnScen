import { afterEach, describe, expect, it } from 'vitest';
import { allowUnsampledLive, unsampledLiveResponse } from './liveSamplingPolicy';

describe('liveSamplingPolicy', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('autorise les lives non échantillonnés hors prod/staging', () => {
    process.env.APP_ENV = 'msdev';
    delete process.env.ALLOW_UNSAMPLED_LIVE;
    expect(allowUnsampledLive()).toBe(true);
  });

  it('interdit en production par défaut', () => {
    process.env.APP_ENV = 'production';
    delete process.env.ALLOW_UNSAMPLED_LIVE;
    expect(allowUnsampledLive()).toBe(false);
  });

  it('autorise si ALLOW_UNSAMPLED_LIVE=1', () => {
    process.env.APP_ENV = 'production';
    process.env.ALLOW_UNSAMPLED_LIVE = '1';
    expect(allowUnsampledLive()).toBe(true);
  });

  it('expose un code API stable', () => {
    expect(unsampledLiveResponse().code).toBe('LIVE_SAMPLING_REQUIRED');
  });
});
