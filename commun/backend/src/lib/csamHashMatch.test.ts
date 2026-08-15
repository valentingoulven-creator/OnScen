import { describe, expect, it, beforeEach } from 'vitest';
import {
  checkCsamHash,
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
  beforeEach(() => {
    resetCsamHashMatchForTests();
  });

  it('autorise un média inconnu', async () => {
    const result = await checkCsamHash(pngDataUrl());
    expect(result.blocked).toBe(false);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
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
