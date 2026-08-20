import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkCsamHash,
  isPhotoDnaBlockingLive,
  isPhotoDnaRequired,
  photoDnaUnavailableLiveResponse,
  rememberBlockedHash,
  resetCsamHashMatchForTests,
  sha256Buffer,
} from './csamHashMatch';

function pngDataUrl(): string {
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  return `data:image/png;base64,${buf.toString('base64')}`;
}

describe('csamHashMatch', () => {
  const env = { ...process.env };

  beforeEach(() => {
    resetCsamHashMatchForTests();
    delete process.env.PHOTODNA_REQUIRED;
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    delete process.env.APP_ENV;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('autorise un média inconnu hors env déployé', async () => {
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(false);
    expect(result.unavailable).toBeUndefined();
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('refuse un média si PHOTODNA_REQUIRED sans clé', async () => {
    process.env.PHOTODNA_REQUIRED = '1';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(true);
    expect(result.unavailable).toBe(true);
  });

  it('refuse un média en production si PhotoDNA absent (défaut required)', async () => {
    process.env.APP_ENV = 'production';
    delete process.env.PHOTODNA_REQUIRED;
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    expect(isPhotoDnaRequired()).toBe(true);
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(true);
    expect(result.unavailable).toBe(true);
  });

  it('refuse un média en préprod si PhotoDNA absent (défaut required)', async () => {
    process.env.APP_ENV = 'preproduction';
    delete process.env.PHOTODNA_REQUIRED;
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(true);
    expect(result.unavailable).toBe(true);
  });

  it('bloque les lives si PhotoDNA requis sans clé', () => {
    process.env.PHOTODNA_REQUIRED = '1';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    expect(isPhotoDnaBlockingLive()).toBe(true);
    expect(photoDnaUnavailableLiveResponse().code).toBe('PHOTODNA_UNAVAILABLE');
  });

  it('n’bloque pas les lives si PHOTODNA_REQUIRED=0', () => {
    process.env.APP_ENV = 'production';
    process.env.PHOTODNA_REQUIRED = '0';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    expect(isPhotoDnaBlockingLive()).toBe(false);
  });

  it('autorise un média en production si PHOTODNA_REQUIRED=0 (opt-out)', async () => {
    process.env.APP_ENV = 'production';
    process.env.PHOTODNA_REQUIRED = '0';
    delete process.env.PHOTODNA_SUBSCRIPTION_KEY;
    expect(isPhotoDnaRequired()).toBe(false);
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(false);
    expect(result.unavailable).toBeUndefined();
  });

  it('bloque un hash déjà mémorisé', async () => {
    const source = pngDataUrl();
    const sha = sha256Buffer(
      Buffer.from(source.replace(/^data:image\/png;base64,/, ''), 'base64')
    );
    rememberBlockedHash(sha, 'test');
    const result = await checkCsamHash(source);
    expect(result.blocked).toBe(true);
    expect(result.source).toBe('local');
  });
});
